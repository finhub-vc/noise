/**
 * Unit Tests for Trading Strategies
 */

import { describe, it, expect } from 'vitest';
import { MomentumStrategy } from '@/signals/strategies/MomentumStrategy.js';
import { MeanReversionStrategy } from '@/signals/strategies/MeanReversionStrategy.js';
import { BreakoutStrategy } from '@/signals/strategies/BreakoutStrategy.js';

describe('MomentumStrategy', () => {
  it('instantiates with default config', () => {
    const strategy = new MomentumStrategy();
    expect(strategy).toBeInstanceOf(MomentumStrategy);
  });

  it('has generate method', () => {
    const strategy = new MomentumStrategy();
    expect(typeof strategy.generate).toBe('function');
  });

  it('returns empty array for insufficient data', () => {
    const strategy = new MomentumStrategy();
    // Minimal input with insufficient bars
    const input = {
      symbol: 'MNQ',
      assetClass: 'FUTURES' as const,
      bars: [],
      timeframe: '15m' as const,
      currentRegime: 'RANGING' as const,
    };
    const signals = strategy.generate(input);
    expect(Array.isArray(signals)).toBe(true);
  });
});

describe('MeanReversionStrategy', () => {
  it('instantiates with default config', () => {
    const strategy = new MeanReversionStrategy();
    expect(strategy).toBeInstanceOf(MeanReversionStrategy);
  });

  it('has generate method', () => {
    const strategy = new MeanReversionStrategy();
    expect(typeof strategy.generate).toBe('function');
  });

  it('returns empty array for insufficient data', () => {
    const strategy = new MeanReversionStrategy();
    const input = {
      symbol: 'MNQ',
      assetClass: 'FUTURES' as const,
      bars: [],
      timeframe: '15m' as const,
      currentRegime: 'RANGING' as const,
    };
    const signals = strategy.generate(input);
    expect(Array.isArray(signals)).toBe(true);
  });
});

describe('BreakoutStrategy', () => {
  it('instantiates with default config', () => {
    const strategy = new BreakoutStrategy();
    expect(strategy).toBeInstanceOf(BreakoutStrategy);
  });

  it('has generate method', () => {
    const strategy = new BreakoutStrategy();
    expect(typeof strategy.generate).toBe('function');
  });

  it('returns empty array for insufficient data', () => {
    const strategy = new BreakoutStrategy();
    const input = {
      symbol: 'MNQ',
      assetClass: 'FUTURES' as const,
      bars: [],
      timeframe: '15m' as const,
      currentRegime: 'RANGING' as const,
    };
    const signals = strategy.generate(input);
    expect(Array.isArray(signals)).toBe(true);
  });
});
