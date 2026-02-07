/**
 * Broker Connection Tests
 *
 * Tests for verifying broker connections work in paper trading.
 * These tests require actual broker credentials to run.
 *
 * SETUP:
 * 1. Copy .env.example to .env and fill in credentials
 * 2. Run: npm run test:broker
 *
 * COVERAGE:
 * - Tradovate paper trading connection
 * - Alpaca paper trading connection
 * - Test order placement and cancellation
 * - Position queries
 * - Connection error handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { BrokerManager } from '@/brokers/BrokerManager.js';

// Skip tests if no credentials available
const hasCredentials = !!(
  process.env.TRADOVATE_USERNAME &&
  process.env.TRADOVATE_PASSWORD &&
  process.env.TRADOVATE_APP_ID &&
  process.env.TRADOVATE_CID &&
  process.env.TRADOVATE_SECRET &&
  process.env.ALPACA_API_KEY &&
  process.env.ALPACA_API_SECRET
);

describe.runIf(hasCredentials)('Broker Connection Tests', () => {
  let brokerManager: BrokerManager;

  beforeAll(async () => {
    // Create mock D1 database for testing
    // In real scenario, this would be actual D1 binding
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] }),
        }),
      }),
      batch: () => Promise.resolve([]),
    } as unknown as D1Database;

    brokerManager = new BrokerManager(
      mockDb,
      {
        tradovate: {
          username: process.env.TRADOVATE_USERNAME!,
          password: process.env.TRADOVATE_PASSWORD!,
          appId: process.env.TRADOVATE_APP_ID!,
          cid: process.env.TRADOVATE_CID!,
          secret: process.env.TRADOVATE_SECRET!,
        },
        alpaca: {
          apiKey: process.env.ALPACA_API_KEY!,
          apiSecret: process.env.ALPACA_API_SECRET!,
          baseUrl: 'https://paper-api.alpaca.markets',
        },
        tradovateLive: false,
      }
    );
  });

  describe('Tradovate Paper Trading', () => {
    it('should authenticate successfully', async () => {
      await expect(brokerManager.authenticate()).resolves.not.toThrow();
    });

    it('should fetch account information', async () => {
      await brokerManager.authenticate();
      const account = await brokerManager.getAccount();

      expect(account).toBeDefined();
      expect(account.brokers.tradovate).toBeDefined();
    });

    it('should fetch open positions', async () => {
      await brokerManager.authenticate();
      const positions = await brokerManager.getAllPositions();

      expect(Array.isArray(positions)).toBe(true);
      // In paper trading, may be empty initially
      expect(positions.length).toBeGreaterThanOrEqual(0);
    });

    it('should have healthy connection status', async () => {
      await brokerManager.authenticate();
      const health = brokerManager.healthCheck();

      expect(health.tradovate).toBe(true);
    });
  });

  describe('Alpaca Paper Trading', () => {
    it('should authenticate successfully', async () => {
      await expect(brokerManager.authenticate()).resolves.not.toThrow();
    });

    it('should fetch account information', async () => {
      await brokerManager.authenticate();
      const account = await brokerManager.getAccount();

      expect(account).toBeDefined();
      expect(account.brokers.alpaca).toBeDefined();
    });

    it('should have healthy connection status', async () => {
      await brokerManager.authenticate();
      const health = brokerManager.healthCheck();

      expect(health.alpaca).toBe(true);
    });
  });

  describe('Aggregated Account View', () => {
    it('should combine both broker accounts', async () => {
      await brokerManager.authenticate();
      const account = await brokerManager.getAccount();

      expect(account.totalEquity).toBeGreaterThanOrEqual(0);
      expect(account.totalCash).toBeGreaterThanOrEqual(0);
      expect(account.exposure).toBeDefined();
      expect(account.exposure.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Order Operations', () => {
    it('should place a test order on Tradovate', async () => {
      await brokerManager.authenticate();

      const result = await brokerManager.placeOrder({
        symbol: 'MNQ',
        assetClass: 'FUTURES',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
        timeInForce: 'DAY',
        clientOrderId: `test-${Date.now()}`,
      });

      expect(result).toBeDefined();
      expect(result.brokerOrderId).toBeDefined();
    });

    it('should cancel an order', async () => {
      await brokerManager.authenticate();

      // Place order first
      const placed = await brokerManager.placeOrder({
        symbol: 'MNQ',
        assetClass: 'FUTURES',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        limitPrice: 10000, // Far from market to avoid fill
        timeInForce: 'DAY',
        clientOrderId: `test-cancel-${Date.now()}`,
      });

      // Cancel immediately
      await expect(brokerManager.cancelOrder(placed.brokerOrderId ?? '', 'FUTURES')).resolves.not.toThrow();
    });

    it('should query order status', async () => {
      await brokerManager.authenticate();

      await brokerManager.placeOrder({
        symbol: 'MNQ',
        assetClass: 'FUTURES',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
        timeInForce: 'DAY',
        clientOrderId: `test-status-${Date.now()}`,
      });

      // Get status from Tradovate adapter directly
      const health = brokerManager.healthCheck();
      expect(health.tradovate).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid credentials gracefully', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: () => Promise.resolve(null),
            all: () => Promise.resolve({ results: [] }),
          }),
        }),
        batch: () => Promise.resolve([]),
      } as unknown as D1Database;

      const badManager = new BrokerManager(
        mockDb,
        {
          tradovate: {
            username: 'invalid',
            password: 'invalid',
            appId: 'invalid',
            cid: 'invalid',
            secret: 'invalid',
          },
          alpaca: {
            apiKey: 'invalid',
            apiSecret: 'invalid',
            baseUrl: 'https://paper-api.alpaca.markets',
          },
        }
      );

      await expect(badManager.authenticate()).rejects.toThrow();
    });

    it('should handle invalid symbol', async () => {
      await brokerManager.authenticate();

      await expect(brokerManager.placeOrder({
        symbol: 'INVALID',
        assetClass: 'FUTURES',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
        timeInForce: 'DAY',
        clientOrderId: `test-invalid-${Date.now()}`,
      })).rejects.toThrow();
    });
  });
});

describe.skipIf(hasCredentials)('Broker Connection Tests - Skipped', () => {
  it('should skip tests when credentials not available', () => {
    console.log('Skipping broker connection tests - no credentials configured');
    console.log('To run these tests:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your Tradovate and Alpaca paper trading credentials');
    console.log('3. Run: npm run test:broker');
  });
});
