/**
 * Guide Service WebSocket protocol — dependency-inverted transport
 *
 * The Guide Service owns conversation logic; the WebSocket transport is
 * injected from outside as a WebSocketServer-like object. Nothing here
 * imports a concrete socket library — the integration wave wires the real
 * transport (and its dependency) from outside, which keeps this module
 * unit-testable with a fake server.
 */

import { handleMessage } from './handler';
import { checkFreeLLMHealth, getFreeLLMInfo } from './llm-router';
import { createSession, getSessionCount } from './session';

/** Socket events the protocol listens for (subset of the `ws` WebSocket surface) */
export type GuideSocketEvent = 'close' | 'pong';

/** Minimal socket surface the protocol needs — matches `ws` WebSocket shape */
export interface GuideSocketLike {
  send(data: string): void;
  /** Protocol-level liveness probe; real `ws` sockets answer with pong automatically */
  ping?(): void;
  /** Hard-close for connections that missed their heartbeat (real `ws` sockets have it) */
  terminate?(): void;
  on?(event: GuideSocketEvent, handler: (payload?: unknown) => void): unknown;
}

/** Minimal server surface — matches `ws` WebSocketServer shape */
export interface GuideSocketServerLike {
  on(event: 'connection', handler: (socket: GuideSocketLike) => void): unknown;
  off?(event: 'connection', handler: (socket: GuideSocketLike) => void): void;
}

/** Message from client to server (spec 04, plus health query) */
export interface GuideClientMessage {
  type: 'init' | 'user' | 'ping' | 'health';
  sessionId?: string;
  patientName?: string;
  stt?: string;
  initialStepId?: string;
  content?: string;
}

/** Delivery config for a message type or template */
export interface DeliverConfig {
  /** Whether to deliver this message type/template to clients and buffer in history */
  deliver: boolean;
}

/**
 * Registry mapping message types and template IDs to delivery config.
 * Generic template responses (cost-estimate, wait-update) that don't provide specific actionable information have deliver: false.
 * The following pseudo-events should not be buffered because they provide generic information rather than actionable details:
 * - 'cost-estimate': Generic cost range, not specific pricing for the patient's case
 * - 'wait-update': Generic wait estimate, not detailed timing information
 * Other message types (assistant, system, error, health, step-change) are always delivered.
 */
export const deliverRegistry: Record<string, DeliverConfig> = {
  'cost-estimate': { deliver: false },
  'wait-update': { deliver: false },
};

/** Check if a message should be delivered based on its type or metadata.templateId */
export function shouldDeliver(message: GuideServerMessage): boolean {
  // Check by message type
  const typeConfig = deliverRegistry[message.type];
  if (typeConfig !== undefined) return typeConfig.deliver;

  // Check by templateId in metadata
  const templateId = message.metadata?.templateId;
  if (templateId) {
    const templateConfig = deliverRegistry[templateId];
    if (templateConfig !== undefined) return templateConfig.deliver;
  }

  // Default: deliver
  return true;
}

/**
 * Message from server to client. Type union is the spec 04 Frontend Contract
 * (assistant, system, step-change, wait-update) plus error and health frames.
 * `content` stays optional because health frames carry their payload in `data`.
 */
export interface GuideServerMessage {
  type: 'assistant' | 'system' | 'error' | 'health' | 'step-change' | 'wait-update';
  content?: string;
  sessionId?: string;
  metadata?: {
    templateId?: string;
    usedLLM?: boolean;
    stepId?: string;
    waitEstimate?: number;
  };
  data?: unknown;
}

export interface GuideTransportOptions {
  /** Injected WebSocketServer-like transport */
  wss: GuideSocketServerLike;
  /** Session id generator (injectable for deterministic tests) */
  newSessionId?: () => string;
  /** Keep-alive ping interval in ms; 0 disables (default 30s) */
  pingIntervalMs?: number;
  /** Predicate telling whether the socket can still receive sends */
  isOpen?: (socket: GuideSocketLike) => boolean;
  /** Log sink; default console.log */
  log?: (message: string) => void;
  /** Called once per accepted connection with its protocol handle */
  onConnection?: (handle: GuideConnectionHandle) => void;
}

export interface GuideServiceHandle {
  /** Detach the connection handler and stop keep-alives on open sockets (call on shutdown) */
  close(): void;
  /** Send the same frame to every open connected socket; payload serialized once */
  broadcast(message: GuideServerMessage): void;
  /** Send a frame only to connections bound to this session id; true when at least one socket received it */
  sendToSession(sessionId: string, message: GuideServerMessage): boolean;
}

/** Parse a raw frame into a typed client message; null when not a valid frame */
function parseClientMessage(raw: string): GuideClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (type !== 'init' && type !== 'user' && type !== 'ping' && type !== 'health') {
    return null;
  }
  return {
    type,
    sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : undefined,
    patientName: typeof obj.patientName === 'string' ? obj.patientName : undefined,
    stt: typeof obj.stt === 'string' ? obj.stt : undefined,
    initialStepId: typeof obj.initialStepId === 'string' ? obj.initialStepId : undefined,
    content: typeof obj.content === 'string' ? obj.content : undefined,
  };
}

export interface GuideConnectionHandle {
  /** Feed one raw client frame into the protocol */
  onMessage(raw: string): Promise<void>;
  /** Client disconnected */
  onClose(): void;
  /** Stop keep-alive timers without a transport close event (service shutdown) */
  dispose(): void;
  /** Session id bound at init; null before init succeeds */
  getSessionId(): string | null;
}

/**
 * Build a per-connection protocol handler. Exposed so tests drive frames
 * directly against a fake socket instead of a live transport.
 */
export function createConnectionHandler(options: {
  socket: GuideSocketLike;
  isOpen?: (socket: GuideSocketLike) => boolean;
  newSessionId?: () => string;
  pingIntervalMs?: number;
  log?: (message: string) => void;
}): GuideConnectionHandle {
  const {
    socket,
    isOpen = () => true,
    newSessionId = () => crypto.randomUUID(),
    pingIntervalMs = 30_000,
    log = (message) => console.log(message),
  } = options;

  let sessionId: string | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let isAlive = true;

const send = (message: GuideServerMessage): void => {
    if (!isOpen(socket)) return;
    if (!shouldDeliver(message)) return;
    socket.send(JSON.stringify(message));
  };

  const stopPing = (): void => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  socket.on?.('pong', () => {
    isAlive = true;
  });

  if (pingIntervalMs > 0) {
    pingTimer = setInterval(() => {
      if (!isAlive) {
        stopPing();
        log('[WS] Heartbeat missed, terminating dead connection');
        socket.terminate?.();
        return;
      }
      isAlive = false;
      socket.ping?.();
      send({ type: 'system', content: 'ping' });
    }, pingIntervalMs);
  }

  return {
    async onMessage(raw: string): Promise<void> {
      const message = parseClientMessage(raw);
      if (!message) {
        send({ type: 'error', content: 'Invalid JSON message' });
        return;
      }

      switch (message.type) {
        case 'init': {
          const id = message.sessionId ?? newSessionId();
          const patientName = message.patientName ?? 'Bệnh nhân';
          const stt = message.stt ?? '000';
          const initialStepId = message.initialStepId ?? 'step-ticket';
          try {
            createSession(id, patientName, stt, initialStepId);
            sessionId = id;
            send({
              type: 'system',
              content: 'Đã kết nối. Chào bạn!',
              sessionId: id,
              metadata: { stepId: initialStepId },
            });
            log(`[WS] Session created: ${id} (${patientName}, STT: ${stt})`);
          } catch (err) {
            send({
              type: 'error',
              content: err instanceof Error ? err.message : 'Failed to create session',
            });
          }
          return;
        }

        case 'user': {
          if (!sessionId) {
            send({ type: 'error', content: 'Session not initialized. Send init first.' });
            return;
          }
          const content = message.content?.trim();
          if (!content) {
            send({ type: 'error', content: 'Empty message' });
            return;
          }
          try {
            const result = await handleMessage(sessionId, content);
            send({
              type: 'assistant',
              content: result.content,
              sessionId,
              metadata: { templateId: result.templateId, usedLLM: result.usedLLM },
            });
          } catch (err) {
            log(`[WS] Handle message error: ${err instanceof Error ? err.message : String(err)}`);
            send({
              type: 'error',
              content: err instanceof Error ? err.message : 'Failed to process message',
            });
          }
          return;
        }

        case 'ping': {
          send({ type: 'system', content: 'pong' });
          return;
        }

        case 'health': {
          const freellmInfo = getFreeLLMInfo();
          const healthy = await checkFreeLLMHealth();
          send({
            type: 'health',
            data: {
              status: healthy ? 'ok' : 'degraded',
              sessions: getSessionCount(),
              freellm: { url: freellmInfo.url, stubMode: freellmInfo.stubMode, healthy },
            },
          });
          return;
        }
      }
    },

    onClose(): void {
      stopPing();
      if (sessionId) {
        log(`[WS] Session closed: ${sessionId}`);
      }
    },

    dispose(): void {
      stopPing();
    },

    getSessionId(): string | null {
      return sessionId;
    },
  };
}

/** Attach the Guide Service protocol to an injected WebSocketServer-like transport */
export function attachGuideService(options: GuideTransportOptions): GuideServiceHandle {
  const isOpen = options.isOpen ?? (() => true);
  const log = options.log ?? ((message: string) => console.log(message));

  interface TrackedConnection {
    socket: GuideSocketLike;
    getSessionId(): string | null;
    dispose(): void;
  }
  const connections = new Set<TrackedConnection>();

  const connectionHandler = (socket: GuideSocketLike): void => {
    const handle = createConnectionHandler({
      socket,
      isOpen,
      newSessionId: options.newSessionId,
      pingIntervalMs: options.pingIntervalMs,
      log,
    });
    const tracked: TrackedConnection = {
      socket,
      getSessionId: () => handle.getSessionId(),
      dispose: () => handle.dispose(),
    };
    connections.add(tracked);
    options.onConnection?.(handle);
    socket.on?.('close', () => {
      connections.delete(tracked);
      handle.onClose();
    });
  };
  options.wss.on('connection', connectionHandler);

  // A failed deliver means the socket cannot receive frames; its close event
  // may never arrive (missed teardown), so drop it from the registry here or
  // every later broadcast keeps targeting the dead socket.
  const deliver = (conn: TrackedConnection, raw: string): boolean => {
    if (!isOpen(conn.socket)) {
      connections.delete(conn);
      return false;
    }
    try {
      conn.socket.send(raw);
      return true;
    } catch (err) {
      log(`[WS] Send failed: ${err instanceof Error ? err.message : String(err)}`);
      connections.delete(conn);
      return false;
    }
  };

  return {
    broadcast(message: GuideServerMessage): void {
      if (!shouldDeliver(message)) return;
      const raw = JSON.stringify(message);
      for (const conn of connections) {
        deliver(conn, raw);
      }
    },

    sendToSession(sessionId: string, message: GuideServerMessage): boolean {
      if (!shouldDeliver(message)) return false;
      const raw = JSON.stringify(message);
      let delivered = false;
      for (const conn of connections) {
        if (conn.getSessionId() !== sessionId) continue;
        if (deliver(conn, raw)) delivered = true;
      }
      return delivered;
    },

    close(): void {
      options.wss.off?.('connection', connectionHandler);
      for (const conn of connections) {
        conn.dispose();
      }
      connections.clear();
    },
  };
}
