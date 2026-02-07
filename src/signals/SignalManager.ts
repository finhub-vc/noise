/**
 * Signal Manager
 * Orchestrates signal generation from all strategies
 * Applies regime and time filters before outputting signals
 */

import type { Signal, MarketRegime, Timeframe, AssetClass, PriceBar } from '@/types/signal.js';
import { MomentumStrategy } from './strategies/MomentumStrategy.js';
import { MeanReversionStrategy } from './strategies/MeanReversionStrategy.js';
import { BreakoutStrategy } from './strategies/BreakoutStrategy.js';
import { RegimeDetector } from './RegimeDetector.js';
import { TimeFilter } from './TimeFilter.js';
import type { StrategyInput } from './strategies/types.js';
import { createLogger } from '@/utils/index.js';

const log = createLogger('SIGNAL_MANAGER');

export interface SignalManagerConfig {
  strategies: {
    momentum: { enabled: boolean; weight: number };
    meanReversion: { enabled: boolean; weight: number };
    breakout: { enabled: boolean; weight: number };
  };
  enableRegimeFilter: boolean;
  enableTimeFilter: boolean;
  enableVolatilityFilter: boolean;
  minStrength: number;
  maxSignalsPerSymbol: number;
}

const DEFAULT_CONFIG: SignalManagerConfig = {
  strategies: {
    momentum: { enabled: true, weight: 0.4 },
    meanReversion: { enabled: true, weight: 0.3 },
    breakout: { enabled: true, weight: 0.3 },
  },
  enableRegimeFilter: true,
  enableTimeFilter: true,
  enableVolatilityFilter: true,
  minStrength: 0.6,
  maxSignalsPerSymbol: 2,
};

export interface MarketDataInput {
  symbol: string;
  assetClass: AssetClass;
  bars: PriceBar[];
  timeframe: Timeframe;
}

export class SignalManager {
  private momentumStrategy: MomentumStrategy;
  private meanReversionStrategy: MeanReversionStrategy;
  private breakoutStrategy: BreakoutStrategy;
  private regimeDetector: RegimeDetector;
  private timeFilter: TimeFilter;

  constructor(private config: SignalManagerConfig = DEFAULT_CONFIG) {
    this.momentumStrategy = new MomentumStrategy();
    this.meanReversionStrategy = new MeanReversionStrategy();
    this.breakoutStrategy = new BreakoutStrategy();
    this.regimeDetector = new RegimeDetector();
    this.timeFilter = new TimeFilter();
  }

  /**
   * Generate signals from market data
   */
  async generateSignals(input: MarketDataInput): Promise<Signal[]> {
    log.debug(`Generating signals for ${input.symbol}`);

    // Detect current market regime
    const regimeDetection = this.regimeDetector.detect(input.bars);
    log.debug(`Regime: ${regimeDetection.regime}, ADX: ${regimeDetection.adx.toFixed(1)}`);

    // Check time filter
    if (this.config.enableTimeFilter) {
      const timeCheck = this.timeFilter.isAllowedTime(input.assetClass);
      if (!timeCheck.allowed) {
        log.debug(`Time filter blocked: ${timeCheck.reason}`);
        return [];
      }
    }

    // Check volatility filter
    if (this.config.enableVolatilityFilter && regimeDetection.volatilityLevel === 'high') {
      log.debug('Volatility filter blocked: high volatility');
      // Still allow momentum signals in high volatility
      if (!this.config.strategies.momentum.enabled) {
        return [];
      }
    }

    // Prepare strategy input
    const strategyInput: StrategyInput = {
      symbol: input.symbol,
      assetClass: input.assetClass,
      bars: input.bars,
      timeframe: input.timeframe,
      currentRegime: regimeDetection.regime,
    };

    // Generate signals from each enabled strategy
    const allSignals: Signal[] = [];

    if (this.config.strategies.momentum.enabled) {
      if (this.isRegimeSuitable('momentum', regimeDetection.regime)) {
        const momentumSignals = this.momentumStrategy.generate(strategyInput);
        allSignals.push(...momentumSignals);
        log.debug(`Momentum: ${momentumSignals.length} signals`);
      }
    }

    if (this.config.strategies.meanReversion.enabled) {
      if (this.isRegimeSuitable('meanReversion', regimeDetection.regime)) {
        const meanReversionSignals = this.meanReversionStrategy.generate(strategyInput);
        allSignals.push(...meanReversionSignals);
        log.debug(`Mean Reversion: ${meanReversionSignals.length} signals`);
      }
    }

    if (this.config.strategies.breakout.enabled) {
      if (this.isRegimeSuitable('breakout', regimeDetection.regime)) {
        const breakoutSignals = this.breakoutStrategy.generate(strategyInput);
        allSignals.push(...breakoutSignals);
        log.debug(`Breakout: ${breakoutSignals.length} signals`);
      }
    }

    // Filter by minimum strength
    const strongSignals = allSignals.filter(s => s.strength >= this.config.minStrength);

    // Combine conflicting signals
    const combinedSignals = this.combineSignals(strongSignals);

    // Limit signals per symbol
    const limitedSignals = combinedSignals
      .sort((a, b) => b.strength - a.strength)
      .slice(0, this.config.maxSignalsPerSymbol);

    log.info(`Generated ${limitedSignals.length} signals for ${input.symbol}`);

    return limitedSignals;
  }

  /**
   * Generate signals for multiple symbols
   */
  async generateMultiSignals(inputs: MarketDataInput[]): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    for (const input of inputs) {
      const signals = await this.generateSignals(input);
      allSignals.push(...signals);
    }

    // Group by symbol and limit per symbol
    const bySymbol = new Map<string, Signal[]>();
    for (const signal of allSignals) {
      const existing = bySymbol.get(signal.symbol) || [];
      existing.push(signal);
      bySymbol.set(signal.symbol, existing);
    }

    const result: Signal[] = [];
    for (const [, signals] of bySymbol) {
      const topSignals = signals
        .sort((a, b) => b.strength - a.strength)
        .slice(0, this.config.maxSignalsPerSymbol);
      result.push(...topSignals);
    }

    return result;
  }

  /**
   * Combine signals in the same direction
   */
  private combineSignals(signals: Signal[]): Signal[] {
    // Group by direction
    const longSignals = signals.filter(s => s.direction === 'LONG');
    const shortSignals = signals.filter(s => s.direction === 'SHORT');

    // Keep best signal in each direction
    const bestLong = this.getBestSignal(longSignals);
    const bestShort = this.getBestSignal(shortSignals);

    const combined: Signal[] = [];
    if (bestLong) combined.push(bestLong);
    if (bestShort) combined.push(bestShort);

    return combined;
  }

  /**
   * Get the strongest signal from a list
   */
  private getBestSignal(signals: Signal[]): Signal | null {
    if (signals.length === 0) return null;
    if (signals.length === 1) return signals[0];

    // Sort by strength and return best
    return signals.sort((a, b) => b.strength - a.strength)[0];
  }

  /**
   * Check if regime is suitable for strategy
   */
  private isRegimeSuitable(strategy: 'momentum' | 'meanReversion' | 'breakout', regime: MarketRegime): boolean {
    return this.regimeDetector.isRegimeSuitable(regime, strategy);
  }

  /**
   * Validate an existing signal (check if still valid)
   */
  validateSignal(signal: Signal): boolean {
    const now = Date.now();

    // Check expiry
    if (now > signal.expiresAt) {
      return false;
    }

    // Check time filter
    if (this.config.enableTimeFilter) {
      const timeCheck = this.timeFilter.isAllowedTime(signal.assetClass);
      if (!timeCheck.allowed) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current market regime for a symbol
   */
  getRegime(input: MarketDataInput) {
    return this.regimeDetector.detect(input.bars);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SignalManagerConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update strategy enable states
    if (updates.strategies?.momentum !== undefined) {
      this.config.strategies.momentum = { ...this.config.strategies.momentum, ...updates.strategies.momentum };
    }
    if (updates.strategies?.meanReversion !== undefined) {
      this.config.strategies.meanReversion = { ...this.config.strategies.meanReversion, ...updates.strategies.meanReversion };
    }
    if (updates.strategies?.breakout !== undefined) {
      this.config.strategies.breakout = { ...this.config.strategies.breakout, ...updates.strategies.breakout };
    }
  }

  /**
   * Get configuration
   */
  getConfig(): SignalManagerConfig {
    return { ...this.config };
  }

  /**
   * Enable or disable a strategy
   */
  setStrategyEnabled(strategy: 'momentum' | 'meanReversion' | 'breakout', enabled: boolean): void {
    this.config.strategies[strategy].enabled = enabled;
    log.info(`${strategy} strategy ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get active strategies
   */
  getActiveStrategies(): string[] {
    const active: string[] = [];
    if (this.config.strategies.momentum.enabled) active.push('momentum');
    if (this.config.strategies.meanReversion.enabled) active.push('meanReversion');
    if (this.config.strategies.breakout.enabled) active.push('breakout');
    return active;
  }
}
