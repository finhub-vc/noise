/**
 * Shared Strategy Types
 */

import type { Signal, MarketRegime, Timeframe } from '@/types/signal.js';
import type { PriceBar } from '@/types/signal.js';

export interface StrategyInput {
  symbol: string;
  assetClass: 'FUTURES' | 'EQUITY';
  bars: PriceBar[];
  timeframe: Timeframe;
  currentRegime: MarketRegime;
}

export interface StrategyConfig {
  minStrength: number;
  enabled: boolean;
}

export interface StrategyResult {
  signals: Signal[];
  metadata: {
    regime: MarketRegime;
    timestamp: number;
    indicatorsUsed: string[];
  };
}
