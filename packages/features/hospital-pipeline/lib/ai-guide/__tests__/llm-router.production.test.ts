/**
 * LLM Router production-mode tests — FreeLLM gateway paths (non-stub).
 * fetch is stubbed via vi.stubGlobal; no network access, no new dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSession, sessions, type GuideSession } from '../session';
import process from 'node:process';

/** Import llm-router fresh with the given stub flag */
async function importRouter(stub: string) {
  vi.resetModules();
  process.env.FREELLM_STUB = stub;
  const mod = await import('../llm-router');
  return mod;
}

describe('callLLM production mode (stubbed gateway)', () => {
  let session: GuideSession;

  beforeEach(() => {
    sessions.clear();
    session = createSession('llm-prod', 'Test', '001', 'step-queue');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.FREELLM_STUB = 'true';
  });

  it('parses the gateway reply from choices[0].message.content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '  Bạn đang ở bước XẾP HÀNG.  ' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await importRouter('false');
    const res = await callLLM(session, 'Tôi ở đâu?');

    expect(res.usedLLM).toBe(true);
    expect(res.content).toBe('Bạn đang ở bước XẾP HÀNG.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/chat/completions');
    const body = JSON.parse(String(init.body)) as { temperature: number; messages: unknown[] };
    expect(body.temperature).toBe(0.2);
    expect(body.messages[0]).toMatchObject({ role: 'system' });
  });

  it('includes recent history turns as gateway context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    session.history = [
      { role: 'user', content: 'turn-1', timestamp: 1, usedLLM: false },
      { role: 'assistant', content: 'turn-2', timestamp: 2, usedLLM: false, templateId: 'greeting' },
    ];

    const { callLLM } = await importRouter('false');
    await callLLM(session, 'turn-3');

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages.map((m) => m.content)).toEqual(
      expect.arrayContaining(['turn-1', 'turn-2', 'turn-3'])
    );
  });

  it('throws FreeLLM error when the gateway answers non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('gateway down', { status: 503 }))
    );

    const { callLLM } = await importRouter('false');
    await expect(callLLM(session, 'hello')).rejects.toThrow('FreeLLM error: 503');
  });

  it('falls back to a generic reply when the gateway content is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), { status: 200 })
      )
    );

    const { callLLM } = await importRouter('false');
    const res = await callLLM(session, 'hello');
    expect(res.content).toBe('Xin lỗi, tôi không thể trả lời lúc này.');
  });
});

describe('callLLM Authorization header (research/19 §2c)', () => {
  let session: GuideSession;

  const okGateway = () =>
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    );

  beforeEach(() => {
    sessions.clear();
    session = createSession('llm-auth', 'Test', '001', 'step-queue');
    delete process.env.FREELLM_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.FREELLM_STUB = 'true';
    delete process.env.FREELLM_API_KEY;
  });

  it('sends Authorization Bearer header when FREELLM_API_KEY is set', async () => {
    process.env.FREELLM_API_KEY = 'secret-key-123';
    const fetchMock = okGateway();
    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await importRouter('false');
    await callLLM(session, 'hello');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer secret-key-123');
  });

  it('omits the Authorization header when no key is configured', async () => {
    const fetchMock = okGateway();
    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await importRouter('false');
    await callLLM(session, 'hello');

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('treats a whitespace-only key as no key', async () => {
    process.env.FREELLM_API_KEY = '   ';
    const fetchMock = okGateway();
    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await importRouter('false');
    await callLLM(session, 'hello');

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('stub mode never calls fetch even with a key set', async () => {
    process.env.FREELLM_API_KEY = 'secret-key-123';
    const fetchMock = okGateway();
    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await importRouter('true');
    const res = await callLLM(session, 'hello');

    expect(res.content).toContain('[STUB]');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts an injected key via the optional parameter without env', async () => {
    const fetchMock = okGateway();
    vi.stubGlobal('fetch', fetchMock);

    const { callLLM } = await importRouter('false');
    await callLLM(session, 'hello', 'injected-key');

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer injected-key');
  });
});

describe('checkFreeLLMHealth production mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.FREELLM_STUB = 'true';
  });

  it('returns true when the gateway /health answers ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
    const { checkFreeLLMHealth } = await importRouter('false');
    expect(await checkFreeLLMHealth()).toBe(true);
  });

  it('returns false when the gateway is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const { checkFreeLLMHealth } = await importRouter('false');
    expect(await checkFreeLLMHealth()).toBe(false);
  });
});
