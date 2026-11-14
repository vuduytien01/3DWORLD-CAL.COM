/**
 * Guide Service WS entrypoint tests — real `ws` clients against a real
 * WebSocketServer on an ephemeral port (no mocks). Covers the Pattern B
 * wiring end to end: welcome on init, broadcast fan-out, clean shutdown.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createSession, sessions } from '../session';
import { startGuideWsEntry, type GuideWsEntryHandle } from '../ws-entry';

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.once('open', () => resolve(socket));
    socket.once('error', (err) => reject(err));
  });
}

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => resolve(JSON.parse(String(data)) as Record<string, unknown>));
    socket.once('error', (err) => reject(err));
  });
}

function send(socket: WebSocket, message: Record<string, unknown>): void {
  socket.send(JSON.stringify(message));
}

describe('ws-entry (real ws transport, ephemeral port)', () => {
  let handle: GuideWsEntryHandle | null = null;

  beforeEach(() => {
    sessions.clear();
    process.env.FREELLM_STUB = 'true';
  });

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
  });

  it('a client connects and receives the init welcome frame', async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socket = await connect(handle.port);

    send(socket, { type: 'init', patientName: 'Trần Thị B', stt: '015', initialStepId: 'step-queue' });
    const msg = await nextMessage(socket);

    expect(msg.type).toBe('system');
    expect(String(msg.content)).toContain('Đã kết nối');
    expect(typeof msg.sessionId).toBe('string');
    expect((msg.metadata as Record<string, unknown>).stepId).toBe('step-queue');
  });

  it('two clients both receive one identical broadcast frame', async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const socketA = await connect(handle.port);
    const socketB = await connect(handle.port);
    send(socketA, { type: 'init', patientName: 'Trần A', stt: '001', initialStepId: 'step-ticket' });
    send(socketB, { type: 'init', patientName: 'Lê B', stt: '002', initialStepId: 'step-ticket' });
    await nextMessage(socketA);
    await nextMessage(socketB);

    handle.service.broadcast({ type: 'system', content: 'Cập nhật hàng chờ cho mọi bệnh nhân' });

    const [msgA, msgB] = await Promise.all([nextMessage(socketA), nextMessage(socketB)]);
    expect(msgA).toEqual(msgB);
    expect(msgA.content).toBe('Cập nhật hàng chờ cho mọi bệnh nhân');
  });

  it('close handle terminates clients and releases the port', async () => {
    handle = await startGuideWsEntry({ port: 0 });
    const port = handle.port;
    const socket = await connect(port);
    let clientClosed = false;
    socket.on('close', () => {
      clientClosed = true;
    });

    await handle.close();
    handle = null;

    expect(clientClosed).toBe(true);
    expect(socket.readyState).toBe(WebSocket.CLOSED);
    await expect(connect(port)).rejects.toBeInstanceOf(Error);
  });

  it('cleanup interval sweeps stale sessions and stops after close', async () => {
    handle = await startGuideWsEntry({ port: 0, cleanupIntervalMs: 50 });

    createSession('stale-1', 'Trần Cũ', '003', 'step-ticket');
    const stale = sessions.get('stale-1');
    expect(stale).toBeDefined();
    stale!.lastActiveAt = Date.now() - 31 * 60 * 1000;

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sessions.has('stale-1')).toBe(false);

    await handle.close();
    handle = null;

    createSession('fresh-1', 'Trần Mới', '004', 'step-ticket');
    const fresh = sessions.get('fresh-1');
    expect(fresh).toBeDefined();
    fresh!.lastActiveAt = Date.now() - 31 * 60 * 1000;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(sessions.has('fresh-1')).toBe(true);
  });
});
