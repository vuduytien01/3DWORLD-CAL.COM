/**
 * Unit tests for the pure logic extracted from use-guide-ws.ts
 * (research/09 §6.4): backoff machine, reconnect policy, message parse/route,
 * chat push. Node environment — no jsdom, no rendering, no live socket.
 */

import { describe, it, expect } from 'vitest';
import {
  backoffDelay,
  shouldReconnect,
  resolveGuideWsUrl,
  parseGuideMessage,
  isHeartbeatFrame,
  chatEntryFromServer,
  pushChatEntry,
} from '../use-guide-ws';
import { DEFAULT_WS_PORT } from '../index';

describe('backoffDelay — exponential with cap (research/09 §3)', () => {
  it('produces the 1s, 2s, 4s, 8s, 16s series and caps at 30s (jitter=0)', () => {
    const series = [0, 1, 2, 3, 4, 5, 6, 7].map((a) => backoffDelay(a, 0));
    expect(series).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it('full jitter=1 collapses the delay to 0, partial jitter scales linearly', () => {
    expect(backoffDelay(0, 1)).toBe(0);
    expect(backoffDelay(0, 0.25)).toBe(750);
    expect(backoffDelay(4, 0.5)).toBe(8000);
  });
});

describe('shouldReconnect — reconnect policy', () => {
  it('never retries protocol/policy close codes 1002, 1003, 1008', () => {
    expect(shouldReconnect(1002, 0)).toBe(false);
    expect(shouldReconnect(1003, 0)).toBe(false);
    expect(shouldReconnect(1008, 0)).toBe(false);
  });

  it('retries transport-level codes: 1006 lost network, 1011 server error, 1000 normal, 4000 heartbeat', () => {
    for (const code of [1000, 1006, 1011, 4000]) {
      expect(shouldReconnect(code, 0)).toBe(true);
    }
  });

  it('gives up after MAX_ATTEMPTS consecutive drops (no silent battery drain)', () => {
    expect(shouldReconnect(1006, 11)).toBe(true);
    expect(shouldReconnect(1006, 12)).toBe(false);
    expect(shouldReconnect(1006, 50)).toBe(false);
  });
});

describe('resolveGuideWsUrl — port from Guide Service with env override', () => {
  it('defaults to ws://localhost:DEFAULT_WS_PORT (3002, lib/ai-guide/index.ts)', () => {
    expect(DEFAULT_WS_PORT).toBe(3002);
    expect(resolveGuideWsUrl(undefined)).toBe('ws://localhost:3002');
    expect(resolveGuideWsUrl('')).toBe('ws://localhost:3002');
    expect(resolveGuideWsUrl(null)).toBe('ws://localhost:3002');
    expect(resolveGuideWsUrl('   ')).toBe('ws://localhost:3002');
  });

  it('NEXT_PUBLIC_AI_GUIDE_WS-style override wins over the default port', () => {
    expect(resolveGuideWsUrl('ws://192.168.1.50:3002')).toBe('ws://192.168.1.50:3002');
    expect(resolveGuideWsUrl('wss://guide.example.com')).toBe('wss://guide.example.com');
  });
});

describe('parseGuideMessage — boundary parse drops bad frames safely', () => {
  it('parses an assistant frame with metadata', () => {
    const raw = JSON.stringify({
      type: 'assistant',
      content: 'Còn khoảng 22 phút',
      sessionId: 's1',
      metadata: { templateId: 'wait-update', usedLLM: false, waitEstimate: 22 },
    });
    const msg = parseGuideMessage(raw);
    expect(msg).not.toBeNull();
    expect(msg?.type).toBe('assistant');
    expect(msg?.content).toBe('Còn khoảng 22 phút');
    expect(msg?.metadata?.templateId).toBe('wait-update');
    expect(msg?.metadata?.waitEstimate).toBe(22);
  });

  it('returns null for invalid JSON, non-objects, and unknown types', () => {
    expect(parseGuideMessage('not json')).toBeNull();
    expect(parseGuideMessage('42')).toBeNull();
    expect(parseGuideMessage(JSON.stringify({ type: 'token', content: 'x' }))).toBeNull();
    expect(parseGuideMessage(JSON.stringify({ content: 'no type' }))).toBeNull();
  });

  it('passes the server keep-alive ping through so liveness detection can see it', () => {
    const msg = parseGuideMessage(JSON.stringify({ type: 'system', content: 'ping' }));
    expect(msg).not.toBeNull();
    expect(isHeartbeatFrame(msg as NonNullable<ReturnType<typeof parseGuideMessage>>)).toBe(true);
  });

  it('treats non-string frames (Blob/ArrayBuffer) as undecodable', () => {
    expect(parseGuideMessage({ type: 'assistant', content: 'x' })).toBeNull();
  });
});

describe('chatEntryFromServer — server frames to HUD bubbles', () => {
  it('heartbeat ping/pong and health frames never become chat bubbles', () => {
    expect(chatEntryFromServer({ type: 'system', content: 'ping' }, 'a')).toBeNull();
    expect(chatEntryFromServer({ type: 'system', content: 'pong' }, 'b')).toBeNull();
    expect(chatEntryFromServer({ type: 'health', data: {} }, 'c')).toBeNull();
  });

  it('assistant frames become guide bubbles; error frames get the error flavor', () => {
    const assistant = chatEntryFromServer(
      { type: 'assistant', content: 'Bạn đang ở quầy Lễ tân', metadata: { templateId: 'current-status' } },
      'd'
    );
    expect(assistant?.role).toBe('guide');
    expect(assistant?.text).toBe('Bạn đang ở quầy Lễ tân');
    expect(assistant?.flavor).toBeUndefined();

    const error = chatEntryFromServer({ type: 'error', content: 'Empty message' }, 'e');
    expect(error?.flavor).toBe('error');

    const sys = chatEntryFromServer(
      { type: 'system', content: 'Đã kết nối. Chào bạn!', metadata: { stepId: 'step-ticket' } },
      'f'
    );
    expect(sys?.flavor).toBe('system');
  });
});

describe('pushChatEntry — immutable append with display cap', () => {
  it('appends without mutating the previous list', () => {
    const prev = [{ id: 'a', role: 'guide' as const, text: 'x', at: 1 }];
    const next = pushChatEntry(prev, { id: 'b', role: 'user', text: 'y', at: 2 });
    expect(prev).toHaveLength(1);
    expect(next.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('caps the list at 50 entries, keeping the newest', () => {
    let list: ReturnType<typeof pushChatEntry> = [];
    for (let i = 0; i < 55; i += 1) {
      list = pushChatEntry(list, { id: `m${i}`, role: 'guide', text: `t${i}`, at: i });
    }
    expect(list).toHaveLength(50);
    expect(list[0].id).toBe('m5');
    expect(list[49].id).toBe('m54');
  });

  it('respects a custom cap for the HUD demo panel', () => {
    let list: ReturnType<typeof pushChatEntry> = [];
    for (let i = 0; i < 4; i += 1) {
      list = pushChatEntry(list, { id: `c${i}`, role: 'user', text: 't', at: i }, 2);
    }
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.id)).toEqual(['c2', 'c3']);
  });
});
