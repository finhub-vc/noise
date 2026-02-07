/**
 * WebSocket Upgrade Helper
 * Handles WebSocket upgrade requests in Cloudflare Workers
 */

import type { WSMessage } from './wsHandler.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('WS_UPGRADE');

// =============================================================================
// Types
// =============================================================================

export interface WebSocketUpgradeContext {
  request: Request;
  env: {
    NOISE_D1_DATABASE: D1Database;
  };
}

export type WebSocketHandler = (
  request: Request,
  env: { NOISE_D1_DATABASE: D1Database },
  ctx: ExecutionContext
) => Promise<Response>;

// =============================================================================
// WebSocket Upgrade Utility
// =============================================================================

/**
 * Check if a request is a WebSocket upgrade request
 */
export function isWebSocketUpgrade(request: Request): boolean {
  const upgradeHeader = request.headers.get('Upgrade');
  return upgradeHeader?.toLowerCase() === 'websocket';
}

/**
 * Create a WebSocket upgrade response
 * This is used by the main worker to route WebSocket connections
 */
export function upgradeWebSocket(
  request: Request,
  env: { NOISE_D1_DATABASE: D1Database },
  ctx: ExecutionContext
): Response {
  const url = new URL(request.url);

  log.info('WebSocket upgrade request', {
    path: url.pathname,
    origin: request.headers.get('Origin'),
  });

  // Import WebSocketManager dynamically to avoid circular dependencies
  return import('./wsHandler.js').then(({ getWebSocketManager }) => {
    const manager = getWebSocketManager(env.NOISE_D1_DATABASE);
    return manager.handleWebSocket(request, env);
  }).catch((error) => {
    log.error('Failed to handle WebSocket upgrade', error);
    return new Response('WebSocket upgrade failed', { status: 500 });
  });
}

/**
 * Route a request to either the WebSocket handler or regular HTTP handler
 */
export async function routeWebSocketOrHTTP(
  request: Request,
  env: { NOISE_D1_DATABASE: D1Database },
  ctx: ExecutionContext,
  httpHandler: (request: Request, env: { NOISE_D1_DATABASE: D1Database }, ctx: ExecutionContext) => Promise<Response>
): Promise<Response> {
  if (isWebSocketUpgrade(request)) {
    return upgradeWebSocket(request, env, ctx);
  }
  return httpHandler(request, env, ctx);
}

/**
 * Create a WebSocket message for broadcasting
 */
export function createWSMessage(type: WSMessage['type'], data?: unknown): WSMessage {
  return {
    type,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Broadcast a message to all connected WebSocket clients
 */
export async function broadcastToAll(
  db: D1Database,
  type: WSMessage['type'],
  data?: unknown
): Promise<void> {
  try {
    const { getWebSocketManager } = await import('./wsHandler.js');
    const manager = getWebSocketManager(db);
    manager.broadcast(createWSMessage(type, data));
  } catch (error) {
    log.error('Failed to broadcast WebSocket message', error as Error);
  }
}
