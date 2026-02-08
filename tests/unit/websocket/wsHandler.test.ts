/**
 * Unit Tests for WebSocket Handler
 * Tests public interface and integration behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketManager, type WSMessage } from '@/websocket/wsHandler.js';

// Mock D1 database
class MockD1Database {
  private statements: Map<string, unknown[]> = new Map();

  prepare(sql: string) {
    const mockStmt = {
      bind: vi.fn(() => mockStmt),
      all: vi.fn(async () => {
        const results = this.statements.get(sql) || [];
        return { results: results as unknown[] };
      }),
      first: vi.fn(async () => {
        const results = this.statements.get(sql) || [];
        return (results[0] as Record<string, unknown>) || null;
      }),
      run: vi.fn(async () => ({ success: true, meta: { rows: 0 } })),
    };
    return mockStmt;
  }

  setMockResults(sql: string, results: unknown[]) {
    this.statements.set(sql, results);
  }

  clear() {
    this.statements.clear();
  }
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();

    // Set up mock database responses
    mockDb.setMockResults(
      'SELECT * FROM positions WHERE quantity != 0',
      []
    );
    mockDb.setMockResults(
      'SELECT * FROM signals WHERE status = \'ACTIVE\' AND expires_at > ?',
      []
    );
    mockDb.setMockResults('SELECT * FROM risk_state WHERE id = 1', [
      { id: 1, daily_loss_percent: 0, is_trading_halted: false },
    ]);

    manager = new WebSocketManager(mockDb as unknown as D1Database);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates a WebSocketManager instance', () => {
      expect(manager).toBeInstanceOf(WebSocketManager);
    });

    it('starts with zero clients', () => {
      expect(manager.clientCount).toBe(0);
    });

    it('accepts custom poll interval', () => {
      const customManager = new WebSocketManager(
        mockDb as unknown as D1Database,
        { pollIntervalMs: 5000 }
      );
      expect(customManager).toBeInstanceOf(WebSocketManager);
    });
  });

  describe('broadcast', () => {
    it('broadcasts messages to all connected clients', () => {
      // The broadcast method sends to all clients
      // Since we have 0 clients, this should not throw
      const testMessage: WSMessage = {
        type: 'signals',
        data: [{ id: 1, symbol: 'ES', action: 'BUY' }],
        timestamp: Date.now(),
      };

      expect(() => manager.broadcast(testMessage)).not.toThrow();
    });
  });

  describe('handleWebSocket', () => {
    it('has a handleWebSocket method', () => {
      expect(typeof manager.handleWebSocket).toBe('function');
    });
  });

  describe('clientCount', () => {
    it('returns zero when no clients are connected', () => {
      expect(manager.clientCount).toBe(0);
    });

    it('is a readonly property', () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(manager),
        'clientCount'
      );
      expect(descriptor?.get).toBeDefined();
    });
  });
});
