/**
 * Guide Service entry point — transport injected (dependency inversion).
 *
 * The conversation protocol lives in lib/ai-guide/server.ts and is unit-tested
 * against a fake server. This entry does not import a socket library: the
 * integration wave supplies the real WebSocketServer-like transport (e.g. `ws`)
 * and its dependency when approved.
 *
 * Example wiring for the integration wave:
 *
 *   import { WebSocketServer } from 'ws';
 *   import { startGuideService } from './server';
 *
 *   const handle = startGuideService(new WebSocketServer({ port: 3002 }));
 */

import {
  attachGuideService,
  type GuideServiceHandle,
  type GuideSocketServerLike,
  type GuideTransportOptions,
} from './lib/ai-guide/server';

/** Attach the Guide Service to an injected WebSocketServer-like transport */
export function startGuideService(
  wss: GuideSocketServerLike,
  options: Omit<GuideTransportOptions, 'wss'> = {}
): GuideServiceHandle {
  return attachGuideService({ wss, ...options });
}
