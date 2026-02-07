/**
 * WebSocket Handler for Cloudflare Workers
 * Enables real-time bidirectional communication between dashboard and API
 *
 * This is used for:
 * 1. Real-time position updates
 * 2. Live market data streaming
 * 3. Signal notifications
 * 4. Risk state changes
 */

import { createLogger } from '../utils/index.js';

const log = createLogger('WS_HANDLER');

// =============================================================================
// Types
// =============================================================================

export interface WSMessage {
  type: 'positions' | 'quotes' | 'signals' | 'risk' | 'error' | 'ping' | 'pong';
  data?: unknown;
  error?: string;
  timestamp: number;
}

export interface WSClient {
  socket: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

// =============================================================================
// WebSocket Manager
// =============================================================================

interface WebSocketEnv {
  NOISE_D1_DATABASE: D1Database;
}

export class WebSocketManager {
  private clients = new Map<WebSocket, WSClient>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 2000; // 2 seconds

  constructor(private db: D1Database) {}

  /**
   * Handle incoming WebSocket connection
   */
  handleWebSocket(request: Request, env: WebSocketEnv): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Create client entry
    this.clients.set(server, {
      socket: server,
      subscriptions: new Set(),
      lastPing: Date.now(),
    });

    log.info('WebSocket client connected', {
      clientCount: this.clients.size,
    });

    // Start polling if this is the first client
    if (this.clients.size === 1) {
      this.startPolling(env);
    }

    // Handle messages from client
    server.addEventListener('message', async (event) => {
      try {
        await this.handleMessage(server, event.data as string, env);
      } catch (error) {
        log.error('Error handling WebSocket message', error as Error);
        this.sendError(server, `Message handling error: ${(error as Error).message}`);
      }
    });

    // Handle client disconnect
    server.addEventListener('close', () => {
      this.handleDisconnect(server);
    });

    // Handle errors
    server.addEventListener('error', (error) => {
      log.error('WebSocket error', error as Error);
      this.handleDisconnect(server);
    });

    // Send initial data
    void this.sendInitialData(server, env);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(
    socket: WebSocket,
    data: string,
    env: WebSocketEnv
  ): Promise<void> {
    let message: WSMessage;

    try {
      message = JSON.parse(data) as WSMessage;
    } catch {
      this.sendError(socket, 'Invalid JSON message');
      return;
    }

    const client = this.clients.get(socket);
    if (!client) return;

    switch (message.type) {
      case 'ping':
        this.sendMessage(socket, { type: 'pong', timestamp: Date.now() });
        client.lastPing = Date.now();
        break;

      case 'pong':
        client.lastPing = Date.now();
        break;

      case 'quotes':
        // Subscribe to specific symbols
        if (Array.isArray(message.data)) {
          const symbols = message.data as string[];
          for (const symbol of symbols) {
            client.subscriptions.add(symbol);
          }
          log.debug('Client subscribed to quotes', { symbols, clientCount: this.clients.size });
        }
        break;

      default:
        log.warn('Unknown WebSocket message type', { type: message.type });
    }
  }

  /**
   * Send initial data to newly connected client
   */
  private async sendInitialData(socket: WebSocket, env: WebSocketEnv): Promise<void> {
    try {
      // Send positions
      const positionsResult = await env.NOISE_D1_DATABASE.prepare(`
        SELECT * FROM positions WHERE quantity != 0
      `).all();

      this.sendMessage(socket, {
        type: 'positions',
        data: positionsResult.results,
        timestamp: Date.now(),
      });

      // Send active signals
      const signalsResult = await env.NOISE_D1_DATABASE.prepare(`
        SELECT * FROM signals WHERE status = 'ACTIVE' AND expires_at > ?
      `).bind(Date.now()).all();

      this.sendMessage(socket, {
        type: 'signals',
        data: signalsResult.results,
        timestamp: Date.now(),
      });

      // Send risk state
      const riskResult = await env.NOISE_D1_DATABASE.prepare(`
        SELECT * FROM risk_state WHERE id = 1
      `).first();

      this.sendMessage(socket, {
        type: 'risk',
        data: riskResult,
        timestamp: Date.now(),
      });
    } catch (error) {
      log.error('Error sending initial data', error as Error);
    }
  }

  /**
   * Start polling for data updates
   */
  private startPolling(env: WebSocketEnv): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      try {
        await this.broadcastUpdates(env);
      } catch (error) {
        log.error('Error in WebSocket polling', error as Error);
      }
    }, this.POLL_INTERVAL_MS);

    log.info('WebSocket polling started');
  }

  /**
   * Stop polling for updates
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      log.info('WebSocket polling stopped');
    }
  }

  /**
   * Broadcast updates to all connected clients
   */
  private async broadcastUpdates(env: WebSocketEnv): Promise<void> {
    if (this.clients.size === 0) {
      this.stopPolling();
      return;
    }

    // Collect all subscribed symbols
    const subscribedSymbols = new Set<string>();
    for (const client of this.clients.values()) {
      for (const symbol of client.subscriptions) {
        subscribedSymbols.add(symbol);
      }
    }

    // If no specific subscriptions, send general updates
    if (subscribedSymbols.size === 0) {
      await this.broadcastGeneralUpdates(env);
      return;
    }

    // Send quotes for subscribed symbols
    await this.broadcastQuotes(env, Array.from(subscribedSymbols));
  }

  /**
   * Broadcast general updates to all clients
   */
  private async broadcastGeneralUpdates(env: WebSocketEnv): Promise<void> {
    try {
      // Get latest positions
      const positionsResult = await env.NOISE_D1_DATABASE.prepare(`
        SELECT * FROM positions WHERE quantity != 0
      `).all();

      // Get active signals
      const signalsResult = await env.NOISE_D1_DATABASE.prepare(`
        SELECT * FROM signals WHERE status = 'ACTIVE' AND expires_at > ?
      `).bind(Date.now()).all();

      // Get risk state
      const riskResult = await env.NOISE_D1_DATABASE.prepare(`
        SELECT * FROM risk_state WHERE id = 1
      `).first();

      // Broadcast to all clients
      for (const [socket] of this.clients.entries()) {
        try {
          this.sendMessage(socket, {
            type: 'positions',
            data: positionsResult.results,
            timestamp: Date.now(),
          });

          this.sendMessage(socket, {
            type: 'signals',
            data: signalsResult.results,
            timestamp: Date.now(),
          });

          this.sendMessage(socket, {
            type: 'risk',
            data: riskResult,
            timestamp: Date.now(),
          });
        } catch (error) {
          log.error('Error broadcasting to client', error as Error);
          this.handleDisconnect(socket);
        }
      }
    } catch (error) {
      log.error('Error fetching broadcast data', error as Error);
    }
  }

  /**
   * Broadcast quote updates
   */
  private async broadcastQuotes(env: WebSocketEnv, symbols: string[]): Promise<void> {
    try {
      // Get latest quotes from database or external API
      // For now, send a placeholder that would be replaced with real data
      const quotes: Record<string, { last: number; change: number; timestamp: number }> = {};

      for (const symbol of symbols) {
        // In production, this would fetch from broker API
        // For now, use cached values or placeholder
        quotes[symbol] = {
          last: 0,
          change: 0,
          timestamp: Date.now(),
        };
      }

      // Send to clients who subscribed to these symbols
      for (const [socket, client] of this.clients.entries()) {
        const clientQuotes: Record<string, unknown> = {};

        for (const symbol of symbols) {
          if (client.subscriptions.has(symbol)) {
            clientQuotes[symbol] = quotes[symbol];
          }
        }

        if (Object.keys(clientQuotes).length > 0) {
          this.sendMessage(socket, {
            type: 'quotes',
            data: clientQuotes,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      log.error('Error broadcasting quotes', error as Error);
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (client) {
      log.info('WebSocket client disconnected', {
        subscriptions: Array.from(client.subscriptions),
        remainingClients: this.clients.size - 1,
      });
      this.clients.delete(socket);

      // Stop polling if no more clients
      if (this.clients.size === 0) {
        this.stopPolling();
      }
    }
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(socket: WebSocket, message: WSMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      log.error('Error sending WebSocket message', error as Error);
      this.handleDisconnect(socket);
    }
  }

  /**
   * Send error message to client
   */
  private sendError(socket: WebSocket, error: string): void {
    this.sendMessage(socket, {
      type: 'error',
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WSMessage): void {
    for (const [socket] of this.clients.entries()) {
      this.sendMessage(socket, message);
    }
  }

  /**
   * Get current client count
   */
  get clientCount(): number {
    return this.clients.size;
  }
}

// =============================================================================
// Global Manager (for Workers compatibility)
// =============================================================================

const managers = new Map<D1Database, WebSocketManager>();

export function getWebSocketManager(db: D1Database): WebSocketManager {
  if (!managers.has(db)) {
    managers.set(db, new WebSocketManager(db));
  }
  return managers.get(db)!;
}

// Re-export WebSocketPair for type imports
export { WebSocketPair };
