/**
 * Unit Tests for Risk Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskManager } from '../../../src/risk/RiskManager.js';
import type { RiskConfig, Signal } from '../../../src/types/index.js';

describe('RiskManager', () => {
  let riskManager: RiskManager;
  let mockConfig: RiskConfig;

  beforeEach(() => {
    mockConfig = {
      maxRiskPerTradePercent: 2,
      maxDailyLossPercent: 5,
      maxWeeklyLossPercent: 10,
      maxDrawdownPercent: 15,
      maxPositionPercent: 20,
      maxConcurrentPositions: 10,
      maxCorrelatedConcentration: 0.4,
      maxTotalExposurePercent: 200,
      maxOrderValue: 10000,
      minOrderValue: 100,
      maxFuturesExposurePercent: 150,
      maxEquitiesExposurePercent: 100,
      correlationGroups: {
        NASDAQ: {
          name: 'NASDAQ',
          symbols: ['MNQ', 'TQQQ', 'QQQ'],
          maxConcentration: 0.5,
        },
      },
      consecutiveLossLimit: 5,
      cooldownMinutes: 60,
      pdtReserveDayTrades: 0,
    };

    riskManager = new RiskManager(mockConfig);
  });

  describe('initialization', () => {
    it('creates a RiskManager instance', () => {
      expect(riskManager).toBeInstanceOf(RiskManager);
    });
  });

  describe('evaluateOrder', () => {
    it('has evaluateOrder method', () => {
      expect(typeof riskManager.evaluateOrder).toBe('function');
    });

    it('returns a decision for order evaluation', async () => {
      const signal: Signal = {
        id: 'test-signal-1',
        symbol: 'MNQ',
        assetClass: 'FUTURES',
        timeframe: '15m',
        direction: 'LONG',
        strength: 0.8,
        entryPrice: 15000,
        stopLoss: 14900,
        takeProfit: 15200,
        source: 'momentum',
        status: 'ACTIVE',
        reasons: ['Test signal'],
        timestamp: Date.now(),
        indicators: {},
        regime: 'RANGING',
        expiresAt: Date.now() + 3600000,
      };

      const account = {
        totalEquity: 100000,
        totalCash: 50000,
        totalBuyingPower: 200000,
        positions: [],
        realizedPnl: 1000,
        unrealizedPnl: 500,
        marginUsed: 0,
        marginAvailable: 200000,
        exposure: { total: 0, futures: 0, equities: 0 },
        brokers: {},
      };

      const result = await riskManager.evaluateOrder(signal, account);
      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('reason');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.checks)).toBe(true);
    });
  });

  describe('config handling', () => {
    it('accepts valid RiskConfig', () => {
      expect(() => new RiskManager(mockConfig)).not.toThrow();
    });
  });
});
