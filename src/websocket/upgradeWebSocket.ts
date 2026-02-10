/**
 * WebSocket Upgrade Helper
 * Handles WebSocket upgrade requests in Cloudflare Workers
 *
 * ## Security
 * - Origin validation is performed to prevent CSRF attacks
 * - Session validation placeholder for future authentication
 *
 * ## Configuration
 * Use WebSocketManager.addAllowedOrigin(origin) to add allowed origins
 * in production environments.
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
// Configuration
// =============================================================================

/**
 * Allowed origins for WebSocket connections.
 * In production, set this via environment variable or configuration.
 * Empty array means allow all origins (development mode).
 */
let allowedOrigins: string[] = [];

/**
 * Set allowed origins for WebSocket connections
 */
export function setAllowedOrigins(origins: string[]): void {
  allowedOrigins = origins;
  log.info('WebSocket allowed origins updated', { origins });
}

/**
 * Add a single allowed origin
 */
export function addAllowedOrigin(origin: string): void {
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
    log.info('WebSocket allowed origin added', { origin });
  }
}

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
 * Validate request origin for WebSocket connections
 * Returns true if origin is allowed or in development mode
 */
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');

  // No origin header (same-origin request) - allow
  if (!origin) {
    return true;
  }

  // If no allowed origins configured (development mode), allow all
  if (allowedOrigins.length === 0) {
    return true;
  }

  // Check against allowed origins
  for (const allowed of allowedOrigins) {
    // Exact match
    if (origin === allowed) {
      return true;
    }
    // Subdomain match (e.g., *.example.com)
    if (allowed.startsWith('*.') && origin.endsWith(allowed.slice(1))) {
      return true;
    }
  }

  log.warn('WebSocket connection rejected: invalid origin', { origin });
  return false;
}

/**
 * Validate session for WebSocket connections
 * TODO: Implement proper session validation once authentication is added
 * Currently returns true (no authentication required)
 */
async function validateSession(_request: Request, _env: { NOISE_D1_DATABASE: D1Database }): Promise<boolean> {
  // TODO: Implement session validation
  // 1. Extract session token from cookie or header
  // 2. Validate against database or JWT
  // 3. Return true if valid, false otherwise
  return true;
}

/**
 * Create a WebSocket upgrade response
 * This is used by the main worker to route WebSocket connections
 *
 * Note: Returns Promise<Response> because dynamic import is async.
 * Cloudflare Workers fetch handler supports both Response and Promise<Response>.
 */
export async function upgradeWebSocket(
  request: Request,
  env: { NOISE_D1_DATABASE: D1Database },
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  log.info('WebSocket upgrade request', {
    path: url.pathname,
    origin: request.headers.get('Origin'),
  });

  // Validate origin before accepting connection
  if (!validateOrigin(request)) {
    return new Response('Invalid origin', { status: 403 });
  }

  // Validate session (placeholder for future authentication)
  const sessionValid = await validateSession(request, env);
  if (!sessionValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Import WebSocketManager dynamically to avoid circular dependencies
  try {
    const { getWebSocketManager } = await import('./wsHandler.js');
    const manager = getWebSocketManager(env.NOISE_D1_DATABASE);
    return manager.handleWebSocket(request, env);
  } catch (error) {
    log.error('Failed to handle WebSocket upgrade', error as Error);
    return new Response('WebSocket upgrade failed', { status: 500 });
  }
}

/**
 * Route a request to either the WebSocket handler or regular HTTP handler
 */
export function routeWebSocketOrHTTP(
  request: Request,
  env: { NOISE_D1_DATABASE: D1Database },
  ctx: ExecutionContext,
  httpHandler: (request: Request, env: { NOISE_D1_DATABASE: D1Database }, ctx: ExecutionContext) => Promise<Response>
): Response | Promise<Response> {
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
