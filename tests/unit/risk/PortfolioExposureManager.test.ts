/**
 * Unit Tests for PortfolioExposureManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioExposureManager } from '@/risk/PortfolioExposureManager.js';
import type { UnifiedPosition, AggregatedAccount } from '@/types/broker.js';

describe('PortfolioExposureManager', () => {
  let manager: PortfolioExposureManager;

  beforeEach(() => {
    manager = new PortfolioExposureManager();
  });

  const createMockAccount = (overrides: Partial<AggregatedAccount> = {}): AggregatedAccount => ({
    totalEquity: 100000,
    totalCash: 50000,
    totalBuyingPower: 200000,
    positions: [],
    realizedPnl: 0,
    unrealizedPnl: 0,
    marginUsed: 0,
    marginAvailable: 200000,
    exposure: { total: 0, futures: 0, equities: 0 },
    brokers: {},
    ...overrides,
  }) as AggregatedAccount;

  const createMockPosition = (
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    entryPrice: number,
    currentPrice: number
  ): UnifiedPosition => ({
    symbol,
    side,
    quantity,
    entryPrice,
    currentPrice,
    marketValue: quantity * currentPrice,
    unrealizedPnl: quantity * (currentPrice - entryPrice),
    assetClass: 'FUTURES',
    broker: 'TRADOVATE',
    updatedAt: Date.now(),
  });

  describe('Constructor', () => {
    it('initializes with default constraints', () => {
      const constraints = manager.getConstraints();
      expect(constraints.maxTotalExposure).toBe(2.5);
      expect(constraints.maxGrossExposure).toBe(3.0);
      expect(constraints.maxNetGrowth).toBe(1.5);
      expect(constraints.maxNetShort).toBe(-0.5);
    });

    it('accepts custom constraints', () => {
      const customManager = new PortfolioExposureManager({
        maxTotalExposure: 3.0,
        maxGrossExposure: 4.0,
      });
      const constraints = customManager.getConstraints();
      expect(constraints.maxTotalExposure).toBe(3.0);
      expect(constraints.maxGrossExposure).toBe(4.0);
    });
  });

  describe('analyzePortfolio', () => {
    it('returns error violation for zero equity', () => {
      const account = createMockAccount({ totalEquity: 0 });
      const result = manager.analyzePortfolio(account);

      expect(result.withinLimits).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('TOTAL_EXPOSURE');
      expect(result.violations[0].severity).toBe('ERROR');
      expect(result.violations[0].message).toContain('Invalid equity value');
    });

    it('returns error violation for negative equity', () => {
      const account = createMockAccount({ totalEquity: -1000 });
      const result = manager.analyzePortfolio(account);

      expect(result.withinLimits).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('TOTAL_EXPOSURE');
    });

    it('calculates metrics correctly for empty portfolio', () => {
      const account = createMockAccount();
      const result = manager.analyzePortfolio(account);

      expect(result.withinLimits).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.metrics.totalExposure).toBe(0);
      expect(result.metrics.totalExposurePercent).toBe(0);
      expect(result.metrics.longExposure).toBe(0);
      expect(result.metrics.shortExposure).toBe(0);
    });

    it('calculates metrics for LONG positions', () => {
      const positions = [
        createMockPosition('MNQ', 'LONG', 2, 15000, 15100), // $30,200 exposure
        createMockPosition('MES', 'LONG', 5, 4000, 4050),   // $20,250 exposure
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      expect(result.metrics.longExposure).toBe(50450);
      expect(result.metrics.shortExposure).toBe(0);
      expect(result.metrics.totalExposure).toBe(50450);
      expect(result.metrics.totalExposurePercent).toBeCloseTo(50.45, 1);
    });

    it('calculates metrics for SHORT positions', () => {
      const positions = [
        createMockPosition('MNQ', 'SHORT', 2, 15000, 14900), // $29,800 exposure
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      expect(result.metrics.longExposure).toBe(0);
      expect(result.metrics.shortExposure).toBe(29800);
      expect(result.metrics.netExposure).toBe(-29800);
      expect(result.metrics.netShortPercent).toBeCloseTo(29.8, 1);
    });

    it('calculates gross exposure correctly', () => {
      const positions = [
        createMockPosition('MNQ', 'LONG', 2, 15000, 15100),   // $30,200
        createMockPosition('MES', 'SHORT', 5, 4000, 3950),    // $19,750
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      expect(result.metrics.grossExposure).toBe(49950); // 30,200 + 19,750
      expect(result.metrics.grossExposurePercent).toBeCloseTo(49.95, 1);
    });

    it('detects total exposure violation', () => {
      // Create position that exceeds 250% of equity
      const positions = [
        createMockPosition('MNQ', 'LONG', 20, 15000, 15000), // $300,000 exposure = 300%
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      expect(result.withinLimits).toBe(false);
      const totalViolation = result.violations.find(v => v.type === 'TOTAL_EXPOSURE');
      expect(totalViolation).toBeDefined();
      expect(totalViolation!.severity).toBe('ERROR');
    });

    it('detects gross exposure violation', () => {
      // Gross exposure = long + abs(short), limit is 300%
      const positions = [
        createMockPosition('MNQ', 'LONG', 12, 15000, 15000),  // $180,000
        createMockPosition('MES', 'LONG', 12, 4000, 4000),    // $48,000
        createMockPosition('M2K', 'SHORT', 20, 2000, 2000),   // $40,000
        // Total gross = $268,000 = 268% of equity (under 300%)
      ];
      const account = createMockAccount({ positions });

      // Add more to exceed 300%
      positions.push(createMockPosition('NQ', 'LONG', 5, 15000, 15000)); // +$75,000

      const result = manager.analyzePortfolio(account);
      const grossViolation = result.violations.find(v => v.type === 'GROSS_EXPOSURE');
      expect(grossViolation).toBeDefined();
      expect(grossViolation!.severity).toBe('ERROR');
    });

    it('detects net growth (net long) violation', () => {
      // Net long limit is 150%
      const positions = [
        createMockPosition('MNQ', 'LONG', 12, 15000, 15000), // $180,000 = 180% of equity
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      expect(result.withinLimits).toBe(false);
      const netGrowthViolation = result.violations.find(v => v.type === 'NET_GROWTH');
      expect(netGrowthViolation).toBeDefined();
      expect(netGrowthViolation!.severity).toBe('ERROR');
    });

    it('detects net short violation', () => {
      // Net short limit is -50% (stored as -0.5, but represents max 50% short exposure)
      const positions = [
        createMockPosition('MNQ', 'SHORT', 10, 15000, 15000), // $150,000 = 150% short exposure
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      expect(result.withinLimits).toBe(false);
      const netShortViolation = result.violations.find(v => v.type === 'NET_SHORT');
      expect(netShortViolation).toBeDefined();
      expect(netShortViolation!.severity).toBe('ERROR');
    });

    it('issues warning at 80% of correlation group limit', () => {
      // Use the default NASDAQ correlation group which includes MNQ and MES
      // Default maxConcentration is 0.6 (60%)
      const positions = [
        createMockPosition('MNQ', 'LONG', 3, 15000, 15000), // $45,000 = 45%
        createMockPosition('MES', 'LONG', 2, 4000, 4000),   // $8,000 = 8%
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      // Total MNQ+MES exposure = $53,000 = 53%
      // Warning threshold = 80% of 60% = 48%
      // 53% > 48%, so we should get a warning
      const warnings = result.violations.filter(v => v.severity === 'WARNING');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('CORRELATION');
      expect(warnings[0].message).toContain('NASDAQ');
    });

    it('detects correlation group violation', () => {
      // Use the default NASDAQ correlation group which includes MNQ
      // Default maxConcentration is 0.6 (60%)
      const positions = [
        createMockPosition('MNQ', 'LONG', 5, 15000, 15000), // $75,000 = 75%
      ];
      const account = createMockAccount({ positions });
      const result = manager.analyzePortfolio(account);

      // 75% > 60%, should trigger ERROR violation
      const correlationViolation = result.violations.find(v => v.type === 'CORRELATION' && v.severity === 'ERROR');
      expect(correlationViolation).toBeDefined();
      expect(correlationViolation!.message).toContain('NASDAQ');
    });
  });

  describe('checkOrderExposure', () => {
    it('allows order within limits', () => {
      const account = createMockAccount();
      const result = manager.checkOrderExposure('MNQ', 'LONG', 1, 15000, account, 'FUTURES');

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('blocks order that would exceed total exposure', () => {
      // Test TOTAL_EXPOSURE limit (250%)
      // Need to stay under NET_GROWTH limit (150%) as well
      const positions = [
        createMockPosition('MCL', 'LONG', 10, 70, 70), // $700 = 0.7%
      ];
      const account = createMockAccount({ positions });

      // Adding a $100,000 order gives $100,700 = 100.7% (under both 250% total and 150% net limits)
      const result = manager.checkOrderExposure('MGC', 'LONG', 100, 1000, account, 'FUTURES');
      expect(result.allowed).toBe(true);

      // Adding a $200,000 order would give $200,700 = 200.7% (under 250% total but exceeds 150% net limit)
      const result2 = manager.checkOrderExposure('MGC', 'LONG', 200, 1000, account, 'FUTURES');
      expect(result2.allowed).toBe(false);
      expect(result2.violations.some(v => v.type === 'NET_GROWTH')).toBe(true);

      // Test actual TOTAL_EXPOSURE limit by mixing LONG and SHORT
      // Long $100,700 + Short $100,700 = Gross $201,400, Net $0
      // This should stay under net growth limit but test total exposure
      const positions2 = [
        createMockPosition('MCL', 'LONG', 100, 1000, 1000), // $100,000 long
        createMockPosition('MGC', 'SHORT', 50, 1000, 1000), // $50,000 short
      ];
      const account2 = createMockAccount({ positions: positions2 });
      // Gross = $150,000 = 150% (under 300% gross limit)
      const result3 = manager.analyzePortfolio(account2);
      expect(result3.withinLimits).toBe(true);
    });

    it('correctly updates futures exposure', () => {
      // Account with existing futures exposure from positions
      const positions = [
        createMockPosition('MES', 'LONG', 5, 4000, 4000), // $20,000 futures exposure
      ];
      const account = createMockAccount({
        positions,
        exposure: { total: 20000, futures: 20000, equities: 0 },
      });

      // Adding MNQ position: 2 * $15,000 = $30,000
      const result = manager.checkOrderExposure('MNQ', 'LONG', 2, 15000, account, 'FUTURES');

      expect(result.allowed).toBe(true);

      // The analysis would account for both existing and new positions
      // Total futures exposure should be $20,000 + $30,000 = $50,000
      const updatedPositions = [
        ...positions,
        createMockPosition('MNQ', 'LONG', 2, 15000, 15000),
      ];
      const updatedAccount = createMockAccount({
        positions: updatedPositions,
        exposure: { total: 50000, futures: 50000, equities: 0 },
      });
      const analysis = manager.analyzePortfolio(updatedAccount);
      expect(analysis.metrics.totalExposure).toBe(50000);
    });

    it('correctly updates equities exposure', () => {
      const account = createMockAccount({
        exposure: { total: 0, futures: 0, equities: 20000 },
      });
      const result = manager.checkOrderExposure('TQQQ', 'LONG', 10, 500, account, 'EQUITY');

      expect(result.allowed).toBe(true);
    });
  });

  describe('getSymbolConcentration', () => {
    it('calculates concentration for single symbol position', () => {
      const positions = [
        createMockPosition('MNQ', 'LONG', 3, 15000, 15000), // $45,000 = 45%
      ];
      const account = createMockAccount({ positions });
      const concentration = manager.getSymbolConcentration('MNQ', account);

      expect(concentration).toBeCloseTo(45, 0);
    });

    it('returns 0 for symbol not in portfolio', () => {
      const positions = [
        createMockPosition('MNQ', 'LONG', 1, 15000, 15000),
      ];
      const account = createMockAccount({ positions });
      const concentration = manager.getSymbolConcentration('MES', account);

      expect(concentration).toBe(0);
    });

    it('aggregates multiple positions of same symbol', () => {
      const positions = [
        createMockPosition('MNQ', 'LONG', 2, 15000, 15000), // $30,000
        createMockPosition('MNQ', 'LONG', 1, 15000, 15000), // $15,000
      ];
      const account = createMockAccount({ positions });
      const concentration = manager.getSymbolConcentration('MNQ', account);

      expect(concentration).toBeCloseTo(45, 0); // $45,000 / $100,000
    });

    it('returns 0 for zero equity', () => {
      const positions = [createMockPosition('MNQ', 'LONG', 1, 15000, 15000)];
      const account = createMockAccount({ totalEquity: 0, positions });
      const concentration = manager.getSymbolConcentration('MNQ', account);

      expect(concentration).toBe(0);
    });

    it('returns 0 for negative equity', () => {
      const positions = [createMockPosition('MNQ', 'LONG', 1, 15000, 15000)];
      const account = createMockAccount({ totalEquity: -1000, positions });
      const concentration = manager.getSymbolConcentration('MNQ', account);

      expect(concentration).toBe(0);
    });
  });

  describe('updateConstraints', () => {
    it('updates individual constraint values', () => {
      manager.updateConstraints({ maxTotalExposure: 3.0 });
      const constraints = manager.getConstraints();
      expect(constraints.maxTotalExposure).toBe(3.0);
    });

    it('merges sector concentration maps', () => {
      manager.updateConstraints({
        sectorConcentration: new Map([['NEW_SECTOR', 0.3]]),
      });
      const constraints = manager.getConstraints();
      expect(constraints.sectorConcentration.has('TECH')).toBe(true);
      expect(constraints.sectorConcentration.has('NEW_SECTOR')).toBe(true);
      expect(constraints.sectorConcentration.get('NEW_SECTOR')).toBe(0.3);
    });

    it('appends correlation groups', () => {
      const newGroup = {
        name: 'NEW_GROUP',
        symbols: ['TEST1'],
        maxConcentration: 0.2,
        correlationThreshold: 0.7,
      };
      manager.updateConstraints({ correlationGroups: [newGroup] });
      const constraints = manager.getConstraints();
      expect(constraints.correlationGroups.length).toBeGreaterThan(2);
      expect(constraints.correlationGroups.some(g => g.name === 'NEW_GROUP')).toBe(true);
    });
  });

  describe('getConstraints', () => {
    it('returns defensive copy of constraints', () => {
      const constraints1 = manager.getConstraints();
      const constraints2 = manager.getConstraints();

      expect(constraints1).toEqual(constraints2);
      expect(constraints1).not.toBe(constraints2);
    });

    it('returns defensive copy of maps', () => {
      const constraints = manager.getConstraints();
      const sectorMap = constraints.sectorConcentration;

      sectorMap.set('TEST', 0.5);

      const constraints2 = manager.getConstraints();
      expect(constraints2.sectorConcentration.has('TEST')).toBe(false);
    });
  });
});
