/**
 * Guide Service WebSocket protocol tests — fake server + fake socket,
 * no real transport library involved (dependency inversion).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  attachGuideService,
  createConnectionHandler,
  type GuideConnectionHandle,
  type GuideSocketLike,
  type GuideSocketServerLike,
} from '../server';
import { getSession, sessions } from '../session';

interface FakeSocket extends GuideSocketLike {
  sent: string[];
  closeHandlers: Array<() => void>;
  pongHandlers: Array<(payload?: unknown) => void>;
  pingCount: number;
  terminated: boolean;
}

function makeFakeSocket(autoPong = true): FakeSocket {
  const socket: FakeSocket = {
    sent: [],
    closeHandlers: [],
    pongHandlers: [],
    pingCount: 0,
    terminated: false,
    send(data: string): void {
      socket.sent.push(data);
    },
    ping(): void {
      socket.pingCount++;
      // A real `ws` client answers a protocol ping with pong automatically.
      if (autoPong) socket.pongHandlers.forEach((h) => h());
    },
    terminate(): void {
      socket.terminated = true;
      // A real transport fires `close` after a hard termination.
      socket.closeHandlers.forEach((h) => h());
    },
    on(event, handler): unknown {
      if (event === 'close') socket.closeHandlers.push(handler as () => void);
      else socket.pongHandlers.push(handler);
      return socket;
    },
  };
  return socket;
}

interface FakeServer extends GuideSocketServerLike {
  connectionHandlers: Array<(socket: GuideSocketLike) => void>;
  connect(socket: GuideSocketLike): void;
}

function makeFakeServer(): FakeServer {
  const server: FakeServer = {
    connectionHandlers: [],
    on(event, handler) {
      server.connectionHandlers.push(handler);
      return server;
    },
    off(event, handler) {
      server.connectionHandlers = server.connectionHandlers.filter((h) => h !== handler);
    },
    connect(socket: GuideSocketLike): void {
      server.connectionHandlers.forEach((h) => h(socket));
    },
  };
  return server;
}

async function lastSent(socket: FakeSocket): Promise<Record<string, unknown>> {
  expect(socket.sent.length).toBeGreaterThan(0);
  const raw = socket.sent[socket.sent.length - 1];
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('createConnectionHandler (fake socket)', () => {
  beforeEach(() => {
    sessions.clear();
    process.env.FREELLM_STUB = 'true';
  });

  it('init creates a session and sends the system welcome', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage(
      JSON.stringify({ type: 'init', patientName: 'Trần Thị B', stt: '015', initialStepId: 'step-queue' })
    );
    const msg = await lastSent(socket);
    expect(msg.type).toBe('system');
    expect(msg.content).toContain('Đã kết nối');
    const meta = msg.metadata as Record<string, unknown>;
    expect(meta.stepId).toBe('step-queue');
    expect(sessions.size).toBe(1);
    expect(getSession(String(msg.sessionId))?.patientName).toBe('Trần Thị B');
  });

  it('init with an unknown stepId answers with an error frame', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage(JSON.stringify({ type: 'init', initialStepId: 'nope' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('error');
    expect(String(msg.content)).toContain('Unknown stepId');
    expect(sessions.size).toBe(0);
  });

  it('user before init answers with an error frame', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage(JSON.stringify({ type: 'user', content: 'Chào bạn' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('error');
    expect(String(msg.content)).toContain('Session not initialized');
  });

  it('user message routes through templates and answers with metadata', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({
      socket,
      pingIntervalMs: 0,
      newSessionId: () => 'fixed-id',
    });
    await handle.onMessage(
      JSON.stringify({ type: 'init', patientName: 'Lê Văn C', stt: '016', initialStepId: 'step-ticket' })
    );
    await handle.onMessage(JSON.stringify({ type: 'user', content: 'Chào bạn' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('assistant');
    expect(String(msg.content)).toContain('Lê Văn C');
    const meta = msg.metadata as Record<string, unknown>;
    expect(meta.templateId).toBe('greeting');
    expect(meta.usedLLM).toBe(false);
  });

  it('user miss falls back to the LLM stub', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0, newSessionId: () => 'sid-miss' });
    await handle.onMessage(JSON.stringify({ type: 'init' }));
    await handle.onMessage(JSON.stringify({ type: 'user', content: 'Thời tiết hôm nay thế nào?' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('assistant');
    expect(String(msg.content)).toContain('[STUB]');
    const meta = msg.metadata as Record<string, unknown>;
    expect(meta.usedLLM).toBe(true);
  });

  it('empty user content answers with an error frame', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage(JSON.stringify({ type: 'init' }));
    await handle.onMessage(JSON.stringify({ type: 'user', content: '   ' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('error');
    expect(String(msg.content)).toContain('Empty message');
  });

  it('ping answers pong', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage(JSON.stringify({ type: 'ping' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('system');
    expect(msg.content).toBe('pong');
  });

  it('health returns stub-healthy payload', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage(JSON.stringify({ type: 'health' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('health');
    const data = msg.data as Record<string, unknown>;
    expect(data.status).toBe('ok');
    expect(typeof data.sessions).toBe('number');
    expect((data.freellm as Record<string, unknown>).stubMode).toBe(true);
  });

  it('invalid JSON and unknown types answer with an error frame', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 0 });
    await handle.onMessage('not json at all');
    expect((await lastSent(socket)).type).toBe('error');

    await handle.onMessage('42');
    expect((await lastSent(socket)).type).toBe('error');

    await handle.onMessage(JSON.stringify({ type: 'exploit' }));
    expect((await lastSent(socket)).type).toBe('error');
  });

  it('does not send when isOpen reports the socket closed', async () => {
    const socket = makeFakeSocket();
    const handle = createConnectionHandler({
      socket,
      pingIntervalMs: 0,
      isOpen: () => false,
    });
    await handle.onMessage(JSON.stringify({ type: 'ping' }));
    expect(socket.sent).toEqual([]);
  });

  it('keep-alive ping fires on interval and stops after close', async () => {
    vi.useFakeTimers();
    const socket = makeFakeSocket();
    const log = vi.fn();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 1000, log, newSessionId: () => 'ping-sid' });
    await handle.onMessage(JSON.stringify({ type: 'init' }));
    vi.advanceTimersByTime(1000);
    expect(socket.sent.filter((raw) => raw.includes('"content":"ping"')).length).toBe(1);
    handle.onClose();
    vi.advanceTimersByTime(5000);
    expect(socket.sent.filter((raw) => raw.includes('"content":"ping"')).length).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Session closed: ping-sid'));
    vi.useRealTimers();
  });

  it('terminates a connection that misses its heartbeat and stops pinging it', async () => {
    vi.useFakeTimers();
    const socket = makeFakeSocket(false);
    const log = vi.fn();
    const handle = createConnectionHandler({ socket, pingIntervalMs: 1000, log });
    await handle.onMessage(JSON.stringify({ type: 'init' }));

    vi.advanceTimersByTime(1000);
    expect(socket.pingCount).toBe(1);
    expect(socket.terminated).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(socket.terminated).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Heartbeat missed'));

    const pingsAfterTerminate = socket.sent.filter((raw) => raw.includes('"content":"ping"')).length;
    vi.advanceTimersByTime(5000);
    expect(socket.sent.filter((raw) => raw.includes('"content":"ping"')).length).toBe(pingsAfterTerminate);
    vi.useRealTimers();
  });

  it('keeps a connection that answers pongs alive across heartbeat cycles', async () => {
    vi.useFakeTimers();
    const socket = makeFakeSocket(true);
    const handle = createConnectionHandler({ socket, pingIntervalMs: 1000 });
    await handle.onMessage(JSON.stringify({ type: 'init' }));

    vi.advanceTimersByTime(5000);
    expect(socket.pingCount).toBe(5);
    expect(socket.terminated).toBe(false);
    vi.useRealTimers();
  });
});

describe('attachGuideService (fake server)', () => {
  beforeEach(() => {
    sessions.clear();
    process.env.FREELLM_STUB = 'true';
  });

  it('wires the connection handler onto the injected server', () => {
    const server = makeFakeServer();
    const handle = attachGuideService({ wss: server, pingIntervalMs: 0 });
    expect(server.connectionHandlers.length).toBe(1);
    handle.close();
    expect(server.connectionHandlers.length).toBe(0);
  });

  it('init→user end-to-end through a fake server connection', async () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      newSessionId: () => 'e2e-id',
      onConnection: (h) => captured.push(h),
    });
    server.connect(socket);
    expect(captured.length).toBe(1);

    await captured[0].onMessage(
      JSON.stringify({ type: 'init', patientName: 'Vũ Thị F', stt: '019' })
    );
    const welcomeMsg = await lastSent(socket);
    expect(welcomeMsg.type).toBe('system');
    expect(welcomeMsg.sessionId).toBe('e2e-id');

    // "Còn chờ bao lâu?" routes to the wait-update template, which has
    // deliver: false in the registry. The message is processed internally
    // but not sent to the client socket.
    const sentBefore = socket.sent.length;
    await captured[0].onMessage(JSON.stringify({ type: 'user', content: 'Còn chờ bao lâu?' }));
    expect(socket.sent.length).toBe(sentBefore);

    // A greeting still gets delivered (no templateId filter match)
    await captured[0].onMessage(JSON.stringify({ type: 'user', content: 'Chào bạn' }));
    const msg = await lastSent(socket);
    expect(msg.type).toBe('assistant');
    expect(msg.sessionId).toBe('e2e-id');
    const meta = msg.metadata as Record<string, unknown>;
    expect(meta.templateId).toBe('greeting');
    expect(getSession('e2e-id')?.patientName).toBe('Vũ Thị F');
  });

  it('socket close notification reaches the handler and logs the session', async () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const log = vi.fn();
    const captured: GuideConnectionHandle[] = [];
    attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      log,
      newSessionId: () => 'ws-close-id',
      onConnection: (h) => captured.push(h),
    });
    server.connect(socket);

    await captured[0].onMessage(JSON.stringify({ type: 'init' }));
    socket.closeHandlers.forEach((h) => h());
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Session closed: ws-close-id'));
  });

  it('creates sessions with the injected id generator', async () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      newSessionId: () => 'gen-id-7',
      onConnection: (h) => captured.push(h),
    });
    server.connect(socket);
    await captured[0].onMessage(JSON.stringify({ type: 'init', patientName: 'A', stt: '001' }));
    const msg = await lastSent(socket);
    expect(msg.sessionId).toBe('gen-id-7');
    expect(getSession('gen-id-7')).toBeDefined();
  });

  it('broadcast delivers one identical payload to every connected client', async () => {
    const server = makeFakeServer();
    const socketA = makeFakeSocket();
    const socketB = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    let n = 0;
    const service = attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      newSessionId: () => `bc-${++n}`,
      onConnection: (h) => captured.push(h),
    });
    server.connect(socketA);
    server.connect(socketB);
    await captured[0].onMessage(JSON.stringify({ type: 'init', patientName: 'Trần A', stt: '001' }));
    await captured[1].onMessage(JSON.stringify({ type: 'init', patientName: 'Lê B', stt: '002' }));

    service.broadcast({ type: 'system', content: 'Cập nhật hệ thống cho mọi bệnh nhân' });

    const rawA = socketA.sent[socketA.sent.length - 1];
    const rawB = socketB.sent[socketB.sent.length - 1];
    expect(rawA).toBe(rawB);
    const parsed = JSON.parse(rawA) as Record<string, unknown>;
    expect(parsed.type).toBe('system');
    expect(parsed.content).toBe('Cập nhật hệ thống cho mọi bệnh nhân');
  });

  it('keeps per-client sessions independent across simultaneous connections', async () => {
    const server = makeFakeServer();
    const socketA = makeFakeSocket();
    const socketB = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    let n = 0;
    attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      newSessionId: () => `iso-${++n}`,
      onConnection: (h) => captured.push(h),
    });
    server.connect(socketA);
    server.connect(socketB);
    await captured[0].onMessage(JSON.stringify({ type: 'init', patientName: 'Trần A', stt: '001' }));
    await captured[1].onMessage(JSON.stringify({ type: 'init', patientName: 'Lê B', stt: '002' }));

    await captured[0].onMessage(JSON.stringify({ type: 'user', content: 'Chào bạn' }));
    const replyA = await lastSent(socketA);
    expect(String(replyA.content)).toContain('Trần A');

    await captured[1].onMessage(JSON.stringify({ type: 'user', content: 'Chào bạn' }));
    const replyB = await lastSent(socketB);
    expect(String(replyB.content)).toContain('Lê B');

    expect(getSession('iso-1')?.patientName).toBe('Trần A');
    expect(getSession('iso-2')?.patientName).toBe('Lê B');
  });

  it('sendToSession reaches only the socket bound to that session', async () => {
    const server = makeFakeServer();
    const socketA = makeFakeSocket();
    const socketB = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    let n = 0;
    const service = attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      newSessionId: () => `s-${++n}`,
      onConnection: (h) => captured.push(h),
    });
    server.connect(socketA);
    server.connect(socketB);
    await captured[0].onMessage(JSON.stringify({ type: 'init', patientName: 'Trần A', stt: '001' }));
    await captured[1].onMessage(JSON.stringify({ type: 'init', patientName: 'Lê B', stt: '002' }));

    const sentBefore = socketB.sent.length;
    const delivered = service.sendToSession('s-1', {
      type: 'assistant',
      content: 'Cập nhật chờ riêng cho bạn',
      sessionId: 's-1',
    });
    expect(delivered).toBe(true);
    const pushed = JSON.parse(socketA.sent[socketA.sent.length - 1]) as Record<string, unknown>;
    expect(pushed.content).toBe('Cập nhật chờ riêng cho bạn');
    expect(socketB.sent.length).toBe(sentBefore);
    expect(service.sendToSession('no-such-session', { type: 'system', content: 'x' })).toBe(false);
  });

  it('broadcast no longer reaches a socket after it closes', async () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    const service = attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      onConnection: (h) => captured.push(h),
    });
    server.connect(socket);
    await captured[0].onMessage(JSON.stringify({ type: 'init' }));

    const sentBefore = socket.sent.length;
    socket.closeHandlers.forEach((h) => h());
    service.broadcast({ type: 'system', content: 'sau khi đóng' });
    expect(socket.sent.length).toBe(sentBefore);
  });

  it('service close stops heartbeat timers on still-open connections', async () => {
    vi.useFakeTimers();
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    const service = attachGuideService({
      wss: server,
      pingIntervalMs: 1000,
      onConnection: (h) => captured.push(h),
    });
    server.connect(socket);
    await captured[0].onMessage(JSON.stringify({ type: 'init' }));

    vi.advanceTimersByTime(1000);
    expect(socket.sent.filter((raw) => raw.includes('"content":"ping"')).length).toBe(1);

    service.close();
    expect(server.connectionHandlers.length).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(socket.sent.filter((raw) => raw.includes('"content":"ping"')).length).toBe(1);
    vi.useRealTimers();
  });

  it('emits spec 04 step-change and wait-update frames in the Frontend Contract shape', async () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const captured: GuideConnectionHandle[] = [];
    const service = attachGuideService({
      wss: server,
      pingIntervalMs: 0,
      newSessionId: () => 'push-sid',
      onConnection: (h) => captured.push(h),
    });
    server.connect(socket);
    await captured[0].onMessage(JSON.stringify({ type: 'init' }));

    // wait-update has deliver: false in the registry, so it is filtered
    const sentBefore = socket.sent.length;
    service.sendToSession('push-sid', {
      type: 'wait-update',
      content: 'Còn khoảng 5 phút',
      sessionId: 'push-sid',
      metadata: { waitEstimate: 5 },
    });
    expect(socket.sent.length).toBe(sentBefore);

    // step-change is always delivered (no filter match)
    service.broadcast({
      type: 'step-change',
      content: 'Bạn được gọi đến quầy thanh toán',
      metadata: { stepId: 'step-payment' },
    });
    const stepFrame = JSON.parse(socket.sent[socket.sent.length - 1]) as Record<string, unknown>;
    expect(stepFrame.type).toBe('step-change');
    const stepMeta = stepFrame.metadata as Record<string, unknown>;
    expect(stepMeta.stepId).toBe('step-payment');
  });

  it('broadcast drops a connection whose send always fails and never calls send on it again', () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const failingSend = vi.fn(() => {
      throw new Error('broken pipe');
    });
    socket.send = failingSend;
    const log = vi.fn();
    const service = attachGuideService({ wss: server, pingIntervalMs: 0, log });
    server.connect(socket);

    service.broadcast({ type: 'system', content: 'lần 1 tới kết nối hỏng' });
    expect(failingSend).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Send failed'));

    service.broadcast({ type: 'system', content: 'lần 2 không thử lại kết nối đã gỡ' });
    expect(failingSend).toHaveBeenCalledTimes(1);
  });

  it('drops the connection on the first failed send even if later sends would succeed', () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    let attempts = 0;
    const flakySend = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient send failure');
    });
    socket.send = flakySend;
    const service = attachGuideService({ wss: server, pingIntervalMs: 0 });
    server.connect(socket);

    // Chosen policy: gỡ ngay ở lần send hỏng đầu tiên — một lần send thất bại
    // được coi là kết nối chết, phía client chịu trách nhiệm reconnect. Đổi lại
    // là không giữ kết nối zombie trong registry làm mọi broadcast kế tiếp thử
    // gửi vô ích (trade-off ghi trong report server-deliver-gap.md).
    service.broadcast({ type: 'system', content: 'gửi lỗi một lần' });
    service.broadcast({ type: 'system', content: 'không còn thử lại' });
    expect(flakySend).toHaveBeenCalledTimes(1);
  });

  it('drops a connection whose isOpen reports closed even before its close event fires', () => {
    const server = makeFakeServer();
    const socket = makeFakeSocket();
    const isOpen = vi.fn(() => false);
    const service = attachGuideService({ wss: server, pingIntervalMs: 0, isOpen });
    server.connect(socket);

    service.broadcast({ type: 'system', content: 'readyState không còn OPEN' });
    expect(isOpen).toHaveBeenCalledTimes(1);

    service.broadcast({ type: 'system', content: 'bỏ qua, không hỏi lạiisOpen' });
    expect(isOpen).toHaveBeenCalledTimes(1);
  });
});
