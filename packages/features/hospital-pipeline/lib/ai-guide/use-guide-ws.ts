/**
 * AI Guide WebSocket client hook — thin display layer (spec 04) per
 * .scratch/hospital-pipeline/swarm/research/09-react-ws-client-hook.md.
 *
 * Protocol types come from ./server (frozen this wave — never redefined here).
 * Port comes from DEFAULT_WS_PORT (3002, ./index) with env override
 * NEXT_PUBLIC_AI_GUIDE_WS. Pure helpers are exported for unit tests
 * (vitest node env, no jsdom): backoff machine, reconnect policy, message
 * parse/route, chat entry push.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_WS_PORT } from './index';
import type { GuideClientMessage, GuideServerMessage } from './server';

// Reconnect tuning (research/09 §3)
const MIN_DELAY_MS = 1000;
const FACTOR = 2;
const MAX_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 12;
/** A connection that stayed up longer than this is healthy: next drop restarts backoff from 1s */
const MIN_UPTIME_MS = 10_000;

// Heartbeat tuning (research/09 §3): client pings every 25s against the
// server's 30s keep-alive; dead after 2 silent cycles
const HEARTBEAT_MS = 25_000;
const DEAD_AFTER_HEARTBEATS = 2;

/** Close codes a retry cannot fix (research/09 §3) */
const NO_RETRY_CODES = new Set([1002, 1003, 1008]);

/** Connection state machine surfaced to the HUD */
export type GuideWsStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

/**
 * delay(n) = round(min(maxDelay, minDelay * factor^n) * (1 - jitter))
 * attempt is 0-based; jitter in [0, 1). With jitter=0 the series is
 * 1s, 2s, 4s, 8s, 16s, then capped at 30s.
 */
export function backoffDelay(attempt: number, jitter = Math.random()): number {
  const base = Math.min(MAX_DELAY_MS, MIN_DELAY_MS * FACTOR ** Math.max(0, attempt));
  return Math.round(base * (1 - jitter));
}

/** Whether a close with `code` at `attempt` (0-based) should schedule a reconnect */
export function shouldReconnect(code: number, attempt: number): boolean {
  if (NO_RETRY_CODES.has(code)) return false;
  return attempt < MAX_ATTEMPTS;
}

/**
 * Resolve the Guide Service browser URL: env override wins, otherwise the
 * default port the Guide Service runs on (DEFAULT_WS_PORT from ./index).
 */
export function resolveGuideWsUrl(override?: string | null, port: number = DEFAULT_WS_PORT): string {
  if (typeof override === 'string' && override.trim().length > 0) return override;
  return `ws://localhost:${port}`;
}

/** Parse one raw frame into a typed GuideServerMessage; null when not a valid frame */
export function parseGuideMessage(raw: unknown): GuideServerMessage | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (type !== 'assistant' && type !== 'system' && type !== 'error' && type !== 'health') {
    return null;
  }
  const metadata = parseMetadata(obj.metadata);
  return {
    type,
    content: typeof obj.content === 'string' ? obj.content : undefined,
    sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : undefined,
    metadata,
    data: obj.data,
  };
}

function parseMetadata(value: unknown): GuideServerMessage['metadata'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  return {
    templateId: typeof obj.templateId === 'string' ? obj.templateId : undefined,
    usedLLM: typeof obj.usedLLM === 'boolean' ? obj.usedLLM : undefined,
    stepId: typeof obj.stepId === 'string' ? obj.stepId : undefined,
    waitEstimate: typeof obj.waitEstimate === 'number' ? obj.waitEstimate : undefined,
  };
}

// ---------------------------------------------------------------------------
// Chat display model — one bubble per entry, server frames filtered here
// ---------------------------------------------------------------------------

export interface GuideChatEntry {
  id: string;
  role: 'user' | 'guide';
  text: string;
  at: number;
  /** guide bubble flavor: plain assistant, connection notices, errors */
  flavor?: 'system' | 'error';
}

/** Server keep-alive frames must never reach the chat list */
export function isHeartbeatFrame(msg: GuideServerMessage): boolean {
  return msg.type === 'system' && (msg.content === 'ping' || msg.content === 'pong');
}

/** Map a server frame to a chat bubble; null when the frame is not displayable */
export function chatEntryFromServer(
  msg: GuideServerMessage,
  id: string,
  now = Date.now()
): GuideChatEntry | null {
  if (isHeartbeatFrame(msg)) return null;
  if (msg.type === 'health') return null;
  const text = typeof msg.content === 'string' ? msg.content : '';
  if (!text) return null;
  return {
    id,
    role: 'guide',
    text,
    at: now,
    flavor: msg.type === 'error' ? 'error' : msg.type === 'system' ? 'system' : undefined,
  };
}

/** Immutable append with a display cap so a long demo cannot grow the list forever */
export function pushChatEntry(
  list: readonly GuideChatEntry[],
  entry: GuideChatEntry,
  cap = 50
): GuideChatEntry[] {
  const next = [...list, entry];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGuideWsResult {
  status: GuideWsStatus;
  /** Reconnect attempt counter (resets to 0 once online) */
  attempt: number;
  /** Send a client frame; false when the socket is not open or the send threw */
  send(message: GuideClientMessage): boolean;
}

/**
 * Connect to the Guide Service with backoff reconnect + heartbeat and a
 * StrictMode-safe teardown (clear timers → null handlers → close by
 * readyState, research/09 §2). `url` may be omitted to use
 * NEXT_PUBLIC_AI_GUIDE_WS ?? ws://localhost:DEFAULT_WS_PORT.
 */
export function useGuideWs(
  url: string | undefined,
  onMessage?: (msg: GuideServerMessage) => void
): UseGuideWsResult {
  const resolvedUrl = url ?? resolveGuideWsUrl(process.env.NEXT_PUBLIC_AI_GUIDE_WS);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const beatRef = useRef(0);
  const openedAtRef = useRef(0);
  const wasOpenRef = useRef(false);
  const [status, setStatus] = useState<GuideWsStatus>('connecting');
  const [attempt, setAttempt] = useState(0);

  // onMessage lives in a ref so a new callback identity never reconnects
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const teardown = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      // Null all four handlers first so close() cannot re-enter onclose
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1000, 'component cleanup');
        } catch {
          // already closing
        }
      }
      wsRef.current = null;
    }
    setStatus('offline');
    setAttempt(0);
  }, []);

  const connect = useCallback(() => {
    if (typeof WebSocket === 'undefined') {
      setStatus('offline');
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(resolvedUrl);
    } catch {
      setStatus('offline');
      return;
    }
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      openedAtRef.current = Date.now();
      wasOpenRef.current = true;
      beatRef.current = 0;
      attemptRef.current = 0;
      setAttempt(0);
      setStatus('online');
    };

    ws.onmessage = (ev: MessageEvent) => {
      // Any frame from the server proves the connection alive
      beatRef.current = 0;
      const msg = parseGuideMessage(ev.data);
      if (msg) onMessageRef.current?.(msg);
    };

    ws.onclose = (ev: CloseEvent) => {
      wsRef.current = null;
      const uptime = Date.now() - openedAtRef.current;
      if (wasOpenRef.current && uptime >= MIN_UPTIME_MS) attemptRef.current = 0;
      wasOpenRef.current = false;
      if (!shouldReconnect(ev.code, attemptRef.current)) {
        setStatus('offline');
        setAttempt(0);
        return;
      }
      const delay = backoffDelay(attemptRef.current, Math.random());
      setAttempt(attemptRef.current + 1);
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        attemptRef.current += 1;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose always follows onerror; never reconnect from two places
    };
  }, [resolvedUrl]);

  useEffect(() => {
    connect();
    return teardown;
  }, [connect, teardown]);

  // Client heartbeat: ping every 25s, close (and reconnect) after 2 silent cycles
  useEffect(() => {
    const id = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        beatRef.current = 0;
        return;
      }
      beatRef.current += 1;
      if (beatRef.current > DEAD_AFTER_HEARTBEATS) {
        ws.close(4000, 'heartbeat timeout');
        return;
      }
      const ping: GuideClientMessage = { type: 'ping' };
      try {
        ws.send(JSON.stringify(ping));
      } catch {
        // socket dying; onclose schedules the reconnect
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  const send = useCallback((message: GuideClientMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { status, attempt, send };
}
