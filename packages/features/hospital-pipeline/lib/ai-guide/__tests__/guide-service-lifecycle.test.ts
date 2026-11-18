/**
 * Guide Service lifecycle tests — the component as a whole, driven through
 * the real `ws` transport on an ephemeral port (test-component, functional
 * level). Where server.test.ts drives a fake socket, this file drives real
 * sockets end to end: the conversation arc, LLM fallback, error recovery on
 * the same connection, per-session delivery and the client-supplied
 * sessionId contract that the page's `?session=` parameter relies on.
 *
 * KNOWN ISSUE — pinned at the bottom: deliverRegistry silently swallows
 * direct replies whose templateId is wait-update or cost-estimate. The E2E
 * guide test mocks the WebSocket (page.routeWebSocket), so the real server's
 * swallow was never exercised; the mock answers the frame the server should
 * answer. The test documents today's behavior so the fix can flip it.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startGuideService } from "../../../server";
import type { GuideSocketEvent, GuideSocketLike, GuideSocketServerLike } from "../server";
import { getSession, sessions } from "../session";
import { type GuideWsEntryHandle, startGuideWsEntry } from "../ws-entry";

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", (err) => reject(err));
  });
}

function send(socket: WebSocket, message: Record<string, unknown>): void {
  socket.send(JSON.stringify(message));
}

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => resolve(JSON.parse(String(data)) as Record<string, unknown>));
    socket.once("error", (err) => reject(err));
  });
}

describe("Guide Service full conversation arc (real ws transport)", () => {
  let handle: GuideWsEntryHandle | null = null;

  beforeEach(() => {
    sessions.clear();
  });

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
  });

  it("init → template answers with the client-supplied sessionId, history persisted", async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);

    send(socket, {
      type: "init",
      sessionId: "arc-1",
      patientName: "Trần Thị C",
      stt: "099",
      initialStepId: "step-ticket",
    });
    const welcome = await nextMessage(socket);
    expect(welcome.type).toBe("system");
    expect(welcome.sessionId).toBe("arc-1");
    expect((welcome.metadata as Record<string, unknown>).stepId).toBe("step-ticket");

    send(socket, { type: "user", sessionId: "arc-1", content: "Xin chào" });
    const greeting = await nextMessage(socket);
    expect(greeting.type).toBe("assistant");
    expect((greeting.metadata as Record<string, unknown>).templateId).toBe("greeting");

    send(socket, { type: "user", sessionId: "arc-1", content: "Tôi cần làm gì tiếp theo?" });
    const nextStep = await nextMessage(socket);
    expect(nextStep.type).toBe("assistant");
    expect((nextStep.metadata as Record<string, unknown>).templateId).toBe("next-step");

    const session = getSession("arc-1");
    expect(session?.history).toHaveLength(4); // 2 user + 2 assistant turns
    expect(session?.history[0]?.role).toBe("user");
    socket.close();
  });

  it("an unknown question falls back to the LLM stub through the real transport", async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);
    send(socket, {
      type: "init",
      sessionId: "arc-2",
      patientName: "Lê V",
      stt: "100",
      initialStepId: "step-queue",
    });
    await nextMessage(socket);

    send(socket, { type: "user", sessionId: "arc-2", content: "abcdefgh xyz không khớp template nào" });
    const reply = await nextMessage(socket);
    expect(reply.type).toBe("assistant");
    expect((reply.metadata as Record<string, unknown>).usedLLM).toBe(true);
    expect(String(reply.content)).toContain("[STUB]");
    socket.close();
  });

  it("invalid JSON answers an error frame and the SAME connection keeps working", async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);
    send(socket, {
      type: "init",
      sessionId: "arc-3",
      patientName: "Phạm Q",
      stt: "101",
      initialStepId: "step-ticket",
    });
    await nextMessage(socket);

    socket.send("{ not valid json");
    const error = await nextMessage(socket);
    expect(error.type).toBe("error");
    expect(String(error.content)).toContain("Invalid JSON");

    send(socket, { type: "user", sessionId: "arc-3", content: "Xin chào" });
    const recovery = await nextMessage(socket);
    expect(recovery.type).toBe("assistant");
    expect(recovery.content).toBeDefined();
    socket.close();
  });

  it("sendToSession reaches only the socket bound to that session", async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socketA = await connect(handle.port);
    const socketB = await connect(handle.port);
    send(socketA, {
      type: "init",
      sessionId: "iso-a",
      patientName: "A",
      stt: "001",
      initialStepId: "step-ticket",
    });
    send(socketB, {
      type: "init",
      sessionId: "iso-b",
      patientName: "B",
      stt: "002",
      initialStepId: "step-ticket",
    });
    await nextMessage(socketA);
    await nextMessage(socketB);

    const delivered = handle.service.sendToSession("iso-a", {
      type: "system",
      content: "chỉ cho A",
      sessionId: "iso-a",
    });
    expect(delivered).toBe(true);

    const msgA = await nextMessage(socketA);
    expect(String(msgA.content)).toBe("chỉ cho A");
    socketB.close();
    socketA.close();
  });

  it("a second init with the same sessionId replaces the session (page reload semantics)", async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);
    send(socket, {
      type: "init",
      sessionId: "dup-1",
      patientName: "Người Đầu",
      stt: "001",
      initialStepId: "step-ticket",
    });
    await nextMessage(socket);
    send(socket, {
      type: "init",
      sessionId: "dup-1",
      patientName: "Người Mới",
      stt: "002",
      initialStepId: "step-queue",
    });
    await nextMessage(socket);

    const session = getSession("dup-1");
    expect(session?.patientName).toBe("Người Mới");
    expect(session?.stt).toBe("002");
    expect(sessions.size).toBe(1);
    socket.close();
  });
});

describe("startGuideService (package-root wrapper, fake transport)", () => {
  function fakeServer(): { wss: GuideSocketServerLike; onConnection: ((s: GuideSocketLike) => void) | null } {
    let connection: ((s: GuideSocketLike) => void) | null = null;
    const wss: GuideSocketServerLike = {
      on: (event, handler) => {
        if (event === "connection") connection = handler;
        return wss;
      },
      off: () => wss,
    };
    return {
      wss,
      get onConnection() {
        return connection;
      },
    };
  }

  function fakeSocket(): GuideSocketLike & { sent: string[] } {
    const socket = {
      sent: [] as string[],
      send: (data: string) => {
        socket.sent.push(data);
      },
      on: (event: GuideSocketEvent, _handler: (payload?: unknown) => void) => {
        void event;
        return socket;
      },
    };
    return socket;
  }

  it("delegates to attachGuideService: broadcast reaches a connected socket, close detaches", () => {
    const server = fakeServer();
    const handle = startGuideService(server.wss);
    const socket = fakeSocket();
    server.onConnection?.(socket);

    handle.broadcast({ type: "system", content: "toàn trạm" });
    const delivered = JSON.parse(socket.sent[0] ?? "{}") as { type: string; content?: string };
    expect(delivered.type).toBe("system");
    expect(delivered.content).toBe("toàn trạm");

    handle.close();
    socket.sent.length = 0;
    handle.broadcast({ type: "system", content: "sau close" });
    expect(socket.sent).toHaveLength(0);
  });

  it("sendToSession returns false while no connection is bound to that session", () => {
    const server = fakeServer();
    const handle = startGuideService(server.wss);
    expect(handle.sendToSession("nobody", { type: "system", content: "x" })).toBe(false);
    handle.close();
  });
});

describe("KNOWN ISSUE — deliverRegistry swallows direct wait/cost replies (bug candidate)", () => {
  let handle: GuideWsEntryHandle | null = null;

  beforeEach(() => {
    sessions.clear();
  });

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
  });

  async function initArc(
    question: string
  ): Promise<{ socket: WebSocket; frames: Record<string, unknown>[] }> {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);
    send(socket, {
      type: "init",
      sessionId: "ki-1",
      patientName: "Nguyễn K",
      stt: "007",
      initialStepId: "step-ticket",
    });
    await nextMessage(socket); // welcome

    const frames: Record<string, unknown>[] = [];
    socket.on("message", (data) => {
      frames.push(JSON.parse(String(data)) as Record<string, unknown>);
    });
    send(socket, { type: "user", sessionId: "ki-1", content: question });
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { socket, frames };
  }

  it("today: a cost question gets NO assistant frame back (shouldDeliver drops cost-estimate)", async () => {
    const { socket, frames } = await initArc("Chi phí khám bao nhiêu tiền?");
    const replies = frames.filter((f) => f.type === "assistant");
    expect(replies).toHaveLength(0);
    // The turn IS recorded in history — only the delivery is swallowed
    expect(getSession("ki-1")?.history).toHaveLength(2);
    socket.close();
  });

  it("today: a wait-time question also gets NO assistant frame back", async () => {
    const { socket, frames } = await initArc("Thời gian chờ bao lâu?");
    expect(frames.filter((f) => f.type === "assistant")).toHaveLength(0);
    socket.close();
  });

  it("contrast: a greeting question on the same setup DOES deliver", async () => {
    const { socket, frames } = await initArc("Xin chào");
    const replies = frames.filter((f) => f.type === "assistant");
    expect(replies).toHaveLength(1);
    expect((replies[0]?.metadata as Record<string, unknown> | undefined)?.templateId).toBe("greeting");
    socket.close();
  });
});
