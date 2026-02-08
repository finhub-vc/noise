/**
 * WebSocket Upgrade Helper
 * Handles WebSocket upgrade requests in Cloudflare Workers
 */

import type { WSMessage } from './wsHandler.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('WS_UPGRADE');

// =============================================================================
// Constants
// =============================================================================

/** Header name for WebSocket authentication token */
const WS_AUTH_HEADER = 'X-WebSocket-Token';

/** Query parameter name for authentication token (fallback) */
const WS_AUTH_QUERY_PARAM = 'token';

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

export interface WebSocketAuthOptions {
  /** Whether authentication is required (default: true) */
  requireAuth?: boolean;
  /** Function to validate authentication token */
  validateToken?: (token: string, db: D1Database) => Promise<boolean>;
  /** Secret key for JWT validation (if using JWT tokens) */
  jwtSecret?: string;
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
 * Extract authentication token from WebSocket request
 * Checks header first, then query parameter
 */
export function extractAuthToken(request: Request): string | null {
  // Try header first
  const tokenFromHeader = request.headers.get(WS_AUTH_HEADER);
  if (tokenFromHeader) {
    return tokenFromHeader;
  }

  // Fall back to query parameter
  try {
    const url = new URL(request.url);
    return url.searchParams.get(WS_AUTH_QUERY_PARAM);
  } catch {
    return null;
  }
}

/**
 * Validate authentication token against database
 * Checks if token exists and is not expired
 */
export async function validateAuthToken(
  token: string,
  db: D1Database
): Promise<boolean> {
  if (!token || token.length < 10) {
    return false;
  }

  try {
    // Check if token exists in database and is not expired
    const result = await db
      .prepare(`
        SELECT expires_at FROM api_tokens
        WHERE token = ? AND expires_at > ?
        LIMIT 1
      `)
      .bind(token, Date.now())
      .first();

    return result !== null;
  } catch (error) {
    log.error('Error validating auth token', error as Error);
    return false;
  }
}

/**
 * Create a WebSocket upgrade response with optional authentication
 * This is used by the main worker to route WebSocket connections
 */
export function upgradeWebSocket(
  request: Request,
  env: { NOISE_D1_DATABASE: D1Database },
  ctx: ExecutionContext,
  authOptions?: WebSocketAuthOptions
): Response {
  const url = new URL(request.url);

  log.info('WebSocket upgrade request', {
    path: url.pathname,
    origin: request.headers.get('Origin'),
  });

  // Check authentication if required
  const requireAuth = authOptions?.requireAuth ?? true;
  if (requireAuth) {
    const token = extractAuthToken(request);
    const validateFn = authOptions?.validateToken ?? validateAuthToken;

    if (!token) {
      log.warn('WebSocket connection rejected: no auth token');
      return new Response('Authentication required', { status: 401 });
    }

    // Validate token asynchronously
    const validatePromise = validateFn(token, env.NOISE_D1_DATABASE);
    const response = new Response(null, { status: 401 });

    // Return a Response that waits for validation
    return validatePromise.then((isValid) => {
      if (!isValid) {
        log.warn('WebSocket connection rejected: invalid auth token');
        return new Response('Invalid authentication token', { status: 403 });
      }

      // Import WebSocketManager dynamically to avoid circular dependencies
      return import('./wsHandler.js').then(({ getWebSocketManager }) => {
        const manager = getWebSocketManager(env.NOISE_D1_DATABASE);
        return manager.handleWebSocket(request, env);
      }).catch((error) => {
        log.error('Failed to handle WebSocket upgrade', error);
        return new Response('WebSocket upgrade failed', { status: 500 });
      });
    }).catch((error) => {
      log.error('Error validating auth token', error);
      return new Response('Authentication validation failed', { status: 500 });
    });
  }

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
