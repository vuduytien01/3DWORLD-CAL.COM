/**
 * Guide Service entrypoint — real `ws` transport, Pattern B standalone process
 *
 * Next.js route handlers cannot accept WebSocket upgrades, so the Guide
 * Service runs as its own process next to the web app (research 07). This
 * file owns only the concrete socket library, the port from env, connection
 * logging and process shutdown; conversation protocol, heartbeat and close
 * semantics live in ./server behind the dependency-inverted attachGuideService.
 */

import { WebSocket, WebSocketServer } from 'ws';
import process from 'node:process';
import {
  attachGuideService,
  type GuideConnectionHandle,
  type GuideServiceHandle,
  type GuideSocketLike,
} from './server';
import { cleanupStaleSessions } from './session';

const DEFAULT_GUIDE_WS_PORT = 3002;
/** Guide frames are small chat updates; oversized frames are rejected with close code 1009 */
const MAX_PAYLOAD_BYTES = 64 * 1024;
/** How often the in-memory session map is swept for stale entries */
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

export interface GuideWsEntryOptions {
  /** Listen port override (default: GUIDE_WS_PORT env, then 3002); 0 binds an ephemeral port */
  port?: number;
  /**
   * Sweep interval override in ms (default: GUIDE_CLEANUP_INTERVAL_MS env,
   * then 60s); 0 disables the sweep. Stale-session age stays at the
   * cleanupStaleSessions default (30 min idle).
   */
  cleanupIntervalMs?: number;
  /** Log sink; default console.log */
  log?: (message: string) => void;
}

export interface GuideWsEntryHandle {
  /** Real WebSocketServer instance */
  wss: WebSocketServer;
  /** Protocol handle from attachGuideService (broadcast, sendToSession, close) */
  service: GuideServiceHandle;
  /** Actually bound port; differs from the requested one when requesting 0 */
  port: number;
  /** Detach the protocol, terminate connected clients and release the port */
  close(): Promise<void>;
}

function readPortFromEnv(): number {
  const raw = process.env.GUIDE_WS_PORT;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535 ? parsed : DEFAULT_GUIDE_WS_PORT;
}

function readCleanupIntervalFromEnv(): number {
  const raw = process.env.GUIDE_CLEANUP_INTERVAL_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CLEANUP_INTERVAL_MS;
}

/** A real `ws` socket rejects sends once it is closing or fully closed */
function isSocketOpen(socket: GuideSocketLike): boolean {
  const readyState = (socket as { readyState?: number }).readyState;
  return readyState === WebSocket.OPEN;
}

function waitListening(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (wss.address() !== null) {
      resolve();
      return;
    }
    const onError = (err: Error): void => reject(err);
    wss.once('listening', () => {
      wss.off('error', onError);
      resolve();
    });
    wss.on('error', onError);
  });
}

function getBoundPort(wss: WebSocketServer): number {
  const address = wss.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`Guide WS server has no bound TCP address (${String(address)})`);
  }
  return address.port;
}

/**
 * Start the Guide Service on a real `ws` WebSocketServer. Exposed so tests
 * bind port 0 and drive a real ws client against the full stack.
 */
export async function startGuideWsEntry(options: GuideWsEntryOptions = {}): Promise<GuideWsEntryHandle> {
  const log = options.log ?? ((message: string) => console.log(message));
  const wss = new WebSocketServer({
    port: options.port ?? readPortFromEnv(),
    maxPayload: MAX_PAYLOAD_BYTES,
  });

  // attachGuideService does not listen for socket 'message' events (its
  // GuideSocketLike surface only knows close/pong); frames must be forwarded
  // into the protocol handle it hands out per connection.
  const pendingProtocolHandles: GuideConnectionHandle[] = [];

  const service = attachGuideService({
    wss,
    isOpen: isSocketOpen,
    log,
    onConnection: (protocol) => {
      pendingProtocolHandles.push(protocol);
    },
  });
  await waitListening(wss);

  const port = getBoundPort(wss);
  log(`[WS] Guide service listening on ws://localhost:${port}`);

  // Closed connections keep their session in the in-memory Map, so sweep it
  // periodically instead of letting entries live the full 30-minute idle age.
  const cleanupIntervalMs = options.cleanupIntervalMs ?? readCleanupIntervalFromEnv();
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;
  if (cleanupIntervalMs > 0) {
    cleanupTimer = setInterval(() => {
      const cleaned = cleanupStaleSessions();
      if (cleaned > 0) {
        log(`[WS] Cleaned ${cleaned} stale session(s)`);
      }
    }, cleanupIntervalMs);
  }

  let clientCount = 0;
  wss.on('connection', (socket) => {
    clientCount += 1;
    log(`[WS] Client connected (total: ${clientCount})`);

    // EventEmitter runs listeners in registration order: the service's
    // connection handler registered first, so its handle for THIS socket is
    // at the front of the queue when our listener runs.
    const protocol = pendingProtocolHandles.shift();
    if (protocol) {
      socket.on('message', (data, isBinary) => {
        if (isBinary) return;
        void protocol
          .onMessage(String(data))
          .catch((err: unknown) =>
            log(`[WS] Frame handling failed: ${err instanceof Error ? err.message : String(err)}`)
          );
      });
    }

    socket.on('close', () => {
      clientCount -= 1;
      log(`[WS] Client disconnected (total: ${clientCount})`);
    });
  });

  let closed = false;
  return {
    wss,
    service,
    port,
    close(): Promise<void> {
      if (closed) return Promise.resolve();
      closed = true;
      service.close();
      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }

      // ws 8.x close() only stops the HTTP server it created and resolves on
      // the server's 'close' event, which never fires while upgraded sockets
      // stay open — terminate every client first and resolve when the client
      // teardown and the server close have both settled.
      const clients = [...wss.clients];
      const clientCloses = clients.map((client) =>
        client.readyState === WebSocket.CLOSED
          ? Promise.resolve()
          : new Promise<void>((resolve) => client.once('close', resolve))
      );
      for (const client of clients) {
        client.terminate();
      }
      const serverClosed = new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
      return Promise.all([...clientCloses, serverClosed]).then(() => undefined);
    },
  };
}

/** Bun sets import.meta.main only when this file is the process entrypoint */
const isMainProcess = (import.meta as ImportMeta & { main?: boolean }).main === true;

if (isMainProcess) {
  void startGuideWsEntry()
    .then((handle) => {
      const shutdown = (signal: string): void => {
        console.log(`[WS] ${signal} received, closing guide server`);
        void handle.close().then(() => process.exit(0));
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    })
    .catch((err: unknown) => {
      console.error(
        `[WS] Failed to start guide server: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    });
}
