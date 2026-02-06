/**
 * Integration Tests for Signal Flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SignalManager } from '../../src/signals/SignalManager.js';
import { MockMarketDataProvider, setMarketDataProvider } from '../../src/signals/marketData/MarketDataProvider.js';

describe('Signal Generation Flow', () => {
  let signalManager: SignalManager;
  let mockProvider: MockMarketDataProvider;

  beforeEach(() => {
    mockProvider = new MockMarketDataProvider();
    setMarketDataProvider(mockProvider);

    signalManager = new SignalManager({
      strategies: {
        momentum: { enabled: true, weight: 0.4 },
        meanReversion: { enabled: true, weight: 0.3 },
        breakout: { enabled: true, weight: 0.3 },
      },
      enableRegimeFilter: true,
      enableTimeFilter: false,
      enableVolatilityFilter: true,
      minStrength: 0.6,
      maxSignalsPerSymbol: 3,
    });
  });

  describe('initialization', () => {
    it('creates a SignalManager instance', () => {
      expect(signalManager).toBeInstanceOf(SignalManager);
    });

    it('accepts valid config', () => {
      expect(() => {
        new SignalManager({
          strategies: {
            momentum: { enabled: true, weight: 0.4 },
            meanReversion: { enabled: true, weight: 0.3 },
            breakout: { enabled: true, weight: 0.3 },
          },
          enableRegimeFilter: false,
          enableTimeFilter: false,
          enableVolatilityFilter: false,
          minStrength: 0.5,
          maxSignalsPerSymbol: 5,
        });
      }).not.toThrow();
    });
  });

  describe('market data integration', () => {
    it('works with MockMarketDataProvider', () => {
      expect(mockProvider).toBeInstanceOf(MockMarketDataProvider);
    });

    it('fetches historical data from mock provider', async () => {
      const data = await mockProvider.fetchHistoricalData('MNQ', '15m', { limit: 100 });
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
