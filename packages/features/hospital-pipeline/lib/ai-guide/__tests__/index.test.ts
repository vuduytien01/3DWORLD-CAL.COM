/**
 * Public API surface tests — index exports + healthCheck (stub mode).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GUIDE_SERVICE_VERSION,
  DEFAULT_WS_PORT,
  healthCheck,
  triageDepartment,
  attachGuideService,
  matchTemplate,
  createSession,
  sessions,
  STEP_IDS_IN_ORDER,
} from '../index';
import type { GuideSocketServerLike } from '../index';

describe('AI Guide public API (index.ts)', () => {
  beforeEach(() => {
    sessions.clear();
    process.env.FREELLM_STUB = 'true';
  });

  it('exposes version and default port', () => {
    expect(GUIDE_SERVICE_VERSION).toBe('1.0.0');
    expect(DEFAULT_WS_PORT).toBe(3002);
  });

  it('healthCheck reports ok with stub freellm', async () => {
    const health = await healthCheck();
    expect(health.status).toBe('ok');
    expect(health.version).toBe('1.0.0');
    expect(health.sessions).toBe(0);
    expect(health.freellm.stubMode).toBe(true);
    expect(health.freellm.healthy).toBe(true);
  });

  it('re-exports the full service surface', async () => {
    expect(typeof triageDepartment).toBe('function');
    expect(typeof attachGuideService).toBe('function');
    expect(typeof matchTemplate).toBe('function');
    expect(typeof createSession).toBe('function');
    expect(STEP_IDS_IN_ORDER[0]).toBe('step-ticket');
    expect(STEP_IDS_IN_ORDER[STEP_IDS_IN_ORDER.length - 1]).toBe('step-payment');
  });

  it('triage works through the public API', () => {
    expect(triageDepartment('đau bụng')?.code).toBe('KHOA_NOI');
  });

  it('attachGuideService accepts a WebSocketServer-like object', async () => {
    const socket = { sent: [] as string[], send(data: string): void { socket.sent.push(data); } };
    const wss: GuideSocketServerLike = {
      on(_event, handler) {
        handler(socket);
        return wss;
      },
    };
    const handle = attachGuideService({ wss, pingIntervalMs: 0 });
    expect(typeof handle.close).toBe('function');
    handle.close();
  });
});
