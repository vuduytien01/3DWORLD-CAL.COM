/**
 * Config property binding tests — the env-var contract of the Guide Service
 * and the LLM router, adapted from unit-test-config-properties to TypeScript:
 *
 *   GUIDE_WS_PORT             string→number, integer 0..65535, fallback 3002
 *   GUIDE_CLEANUP_INTERVAL_MS string→number, integer > 0, fallback 60000
 *                             (env "0" is NOT a disable; only the option 0 is)
 *   maxPayload                64 KiB, oversized frame → close code 1009
 *   FREELLM_PORT              parseInt + validatePort 1..65535, fallback 3001
 *   FREELLM_HOST              hostname override, default localhost
 *   FREELLM_STUB              exactly the string 'true' enables stub mode
 *
 * Default values, invalid-value fallbacks and type conversions are all
 * asserted through observable behavior (a bound port, a swept session, a
 * closed socket, the URL in getFreeLLMInfo) — never through private helpers.
 *
 * The fallback-to-3002 cases bind the real production default. They fail with
 * EADDRINUSE if a Guide Service occupies 3002 while the unit gate runs, which
 * is the correct outcome: the demo and the unit gate share that port by spec.
 */

import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { DEFAULT_WS_PORT } from "..";
import { createSession, sessions } from "../session";
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

/** Resolve with the close code; oversized frames still fire close (1009). */
function nextCloseCode(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once("close", (code) => resolve(code));
    socket.on("error", () => {
      // The abort path emits error then close; only the code matters here
    });
  });
}

describe("GUIDE_WS_PORT env binding (ws-entry)", () => {
  let handle: GuideWsEntryHandle | null = null;

  beforeEach(() => {
    sessions.clear();
    delete process.env.GUIDE_WS_PORT;
  });

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
    delete process.env.GUIDE_WS_PORT;
  });

  it("a valid numeric env port binds exactly that port and serves a client", async () => {
    process.env.GUIDE_WS_PORT = "0"; // 0 = ephemeral bind, still drives readPortFromEnv
    handle = await startGuideWsEntry();
    expect(Number.isInteger(handle.port)).toBe(true);
    expect(handle.port).toBeGreaterThanOrEqual(1);
    expect(handle.port).toBeLessThanOrEqual(65535);

    const socket = await connect(handle.port);
    send(socket, { type: "init", patientName: "Trần E", stt: "777", initialStepId: "step-ticket" });
    const msg = await nextMessage(socket);
    expect(msg.type).toBe("system");
    socket.close();
  });

  it.each([
    "abc",
    "-1",
    "70000",
    "3.5",
    "",
  ])("invalid env value %j falls back to DEFAULT_WS_PORT 3002", async (invalid) => {
    process.env.GUIDE_WS_PORT = invalid;
    handle = await startGuideWsEntry();
    expect(handle.port).toBe(DEFAULT_WS_PORT);
    expect(handle.port).toBe(3002);
  });
});

describe("GUIDE_CLEANUP_INTERVAL_MS env binding (ws-entry)", () => {
  let handle: GuideWsEntryHandle | null = null;

  beforeEach(() => {
    sessions.clear();
    delete process.env.GUIDE_CLEANUP_INTERVAL_MS;
  });

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
    delete process.env.GUIDE_CLEANUP_INTERVAL_MS;
  });

  async function staleSession(id: string): Promise<void> {
    createSession(id, "Người Cũ", "001", "step-ticket");
    const stale = sessions.get(id);
    if (!stale) throw new Error(`missing session ${id} for staleness`);
    stale.lastActiveAt = Date.now() - 31 * 60 * 1000;
  }

  it("a valid env interval sweeps stale sessions", async () => {
    process.env.GUIDE_CLEANUP_INTERVAL_MS = "40";
    handle = await startGuideWsEntry({ port: 0 });
    await staleSession("env-swept");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(sessions.has("env-swept")).toBe(false);
  });

  it("an invalid env interval falls back to 60s and does not sweep in 300ms", async () => {
    process.env.GUIDE_CLEANUP_INTERVAL_MS = "-5";
    handle = await startGuideWsEntry({ port: 0 });
    await staleSession("env-fallback");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(sessions.has("env-fallback")).toBe(true);
  });

  it('env value "0" falls back to 60s (only the option-level 0 disables the sweep)', async () => {
    process.env.GUIDE_CLEANUP_INTERVAL_MS = "0";
    handle = await startGuideWsEntry({ port: 0 });
    await staleSession("env-zero");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(sessions.has("env-zero")).toBe(true);
  });

  it("option-level cleanupIntervalMs 0 disables the sweep entirely", async () => {
    handle = await startGuideWsEntry({ port: 0, cleanupIntervalMs: 0 });
    await staleSession("opt-zero");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(sessions.has("opt-zero")).toBe(true);
  });
});

describe("ws maxPayload — oversized frame closes with 1009 (ws-entry)", () => {
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

  it("a frame larger than 64 KiB is rejected with close code 1009", async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);
    const closeCode = nextCloseCode(socket);
    send(socket, {
      type: "init",
      patientName: "x".repeat(70 * 1024),
      stt: "001",
      initialStepId: "step-ticket",
    });
    await expect(closeCode).resolves.toBe(1009);
  });
});

describe("FREELLM_PORT / FREELLM_HOST / FREELLM_STUB (llm-router module-load config)", () => {
  interface RouterEnv {
    stub?: string;
    port?: string;
    host?: string;
  }

  async function importRouter(env: RouterEnv = {}) {
    vi.resetModules();
    if (env.stub === undefined) delete process.env.FREELLM_STUB;
    else process.env.FREELLM_STUB = env.stub;
    if (env.port === undefined) delete process.env.FREELLM_PORT;
    else process.env.FREELLM_PORT = env.port;
    if (env.host === undefined) delete process.env.FREELLM_HOST;
    else process.env.FREELLM_HOST = env.host;
    return await import("../llm-router");
  }

  afterEach(() => {
    vi.resetModules();
    delete process.env.FREELLM_PORT;
    delete process.env.FREELLM_HOST;
    process.env.FREELLM_STUB = "true"; // vitest.config default
  });

  it("FREELLM_HOST + valid FREELLM_PORT compose the chat URL", async () => {
    const { getFreeLLMInfo } = await importRouter({ host: "freellm.internal", port: "8080" });
    const info = getFreeLLMInfo();
    expect(info.url).toContain("http://freellm.internal:8080/v1/chat/completions");
    expect(info.stubMode).toBe(false);
  });

  it.each([
    "0",
    "65536",
    "-1",
    "abc",
  ])("invalid FREELLM_PORT %j falls back to 3001 in the URL", async (bad) => {
    const { getFreeLLMInfo } = await importRouter({ port: bad });
    expect(getFreeLLMInfo().url).toContain(":3001/v1/chat/completions");
  });

  it('FREELLM_PORT "3.5" is parseInt-truncated to 3 (documented parseInt edge)', async () => {
    const { getFreeLLMInfo } = await importRouter({ port: "3.5" });
    expect(getFreeLLMInfo().url).toContain(":3/v1/chat/completions");
  });

  it.each(["TRUE", "1", ""])("FREELLM_STUB=%j does not enable stub mode", async (value) => {
    const { getFreeLLMInfo } = await importRouter({ stub: value });
    expect(getFreeLLMInfo().stubMode).toBe(false);
  });

  it('FREELLM_STUB exactly "true" enables stub mode', async () => {
    const { getFreeLLMInfo } = await importRouter({ stub: "true" });
    expect(getFreeLLMInfo().stubMode).toBe(true);
  });
});
