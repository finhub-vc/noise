/**
 * Unit Tests for WebSocket Upgrade Helper
 */

import { describe, it, expect } from 'vitest';
import {
  isWebSocketUpgrade,
  extractAuthToken,
} from '@/websocket/upgradeWebSocket.js';

// Mock Request class
class MockRequest {
  private urlStr: string;
  private headersMap: Map<string, string>;

  constructor(url: string, headers: Record<string, string> = {}) {
    this.urlStr = url;
    this.headersMap = new Map(Object.entries(headers));
  }

  get url() {
    return this.urlStr;
  }

  get headers() {
    return {
      get: (name: string) => this.headersMap.get(name) || null,
      set: (name: string, value: string) => this.headersMap.set(name, value),
      has: (name: string) => this.headersMap.has(name),
      delete: (name: string) => this.headersMap.delete(name),
      entries: () => this.headersMap.entries(),
      keys: () => this.headersMap.keys(),
      values: () => this.headersMap.values(),
    };
  }
}

describe('WebSocket Upgrade Helper', () => {
  describe('isWebSocketUpgrade', () => {
    it('returns true for WebSocket upgrade requests', () => {
      const request = new MockRequest('https://example.com/api/ws', {
        Upgrade: 'websocket',
        Connection: 'Upgrade',
      });

      expect(isWebSocketUpgrade(request as unknown as Request)).toBe(true);
    });

    it('returns false for regular HTTP requests', () => {
      const request = new MockRequest('https://example.com/api/data');

      expect(isWebSocketUpgrade(request as unknown as Request)).toBe(false);
    });

    it('is case-insensitive for the Upgrade header', () => {
      const request = new MockRequest('https://example.com/api/ws', {
        Upgrade: 'WebSocket', // Mixed case - the function lowercases it
      });

      expect(isWebSocketUpgrade(request as unknown as Request)).toBe(true);
    });

    it('returns false for other upgrade types', () => {
      const request = new MockRequest('https://example.com/api/ws', {
        Upgrade: 'h2c',
      });

      expect(isWebSocketUpgrade(request as unknown as Request)).toBe(false);
    });
  });

  describe('extractAuthToken', () => {
    it('extracts token from X-WebSocket-Token header', () => {
      const request = new MockRequest('https://example.com/api/ws', {
        'X-WebSocket-Token': 'test-token-123',
      });

      const token = extractAuthToken(request as unknown as Request);
      expect(token).toBe('test-token-123');
    });

    it('extracts token from query parameter as fallback', () => {
      const request = new MockRequest(
        'https://example.com/api/ws?token=test-token-456'
      );

      const token = extractAuthToken(request as unknown as Request);
      expect(token).toBe('test-token-456');
    });

    it('prioritizes header over query parameter', () => {
      const request = new MockRequest(
        'https://example.com/api/ws?token=query-token',
        {
          'X-WebSocket-Token': 'header-token',
        }
      );

      const token = extractAuthToken(request as unknown as Request);
      expect(token).toBe('header-token');
    });

    it('returns null when no token is present', () => {
      const request = new MockRequest('https://example.com/api/ws');

      const token = extractAuthToken(request as unknown as Request);
      expect(token).toBeNull();
    });

    it('handles malformed URLs gracefully', () => {
      const request = new MockRequest('not-a-valid-url');

      const token = extractAuthToken(request as unknown as Request);
      expect(token).toBeNull();
    });
  });
});
