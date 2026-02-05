/**
 * Momentum Strategy
 * Identifies strong directional moves using RSI and MACD
 */

import type { Signal, SignalDirection, MarketRegime, Timeframe } from '@/types/signal.js';
import type { PriceBar } from '@/types/signal.js';
import { IndicatorResult } from '@/types/signal.js';
import type { StrategyInput } from './types.js';
import { calculateRSI, calculateMACD, rsiSignal, macdSignal } from '../indicators/indicators.js';
import { generateId } from '@/utils/index.js';

export interface MomentumStrategyConfig {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  minStrength: number;
}

const DEFAULT_CONFIG: MomentumStrategyConfig = {
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  minStrength: 0.6,
};

export class MomentumStrategy {
  constructor(private config: MomentumStrategyConfig = DEFAULT_CONFIG) {}

  /**
   * Generate momentum signals based on RSI and MACD
   */
  generate(input: StrategyInput): Signal[] {
    const signals: Signal[] = [];

    if (input.bars.length < this.config.macdSlow + 10) {
      return signals; // Not enough data
    }

    const closes = input.bars.map(b => b.close);
    const highs = input.bars.map(b => b.high);
    const lows = input.bars.map(b => b.low);
    const volumes = input.bars.map(b => b.volume);

    // Calculate indicators
    const rsi = calculateRSI(closes, this.config.rsiPeriod);
    const macdResults = calculateMACD(
      closes,
      this.config.macdFast,
      this.config.macdSlow,
      this.config.macdSignal
    );
    const latestMacd = macdResults[macdResults.length - 1];
    const prevMacd = macdResults[macdResults.length - 2];

    const latestBar = input.bars[input.bars.length - 1];
    const now = Date.now();

    // RSI analysis
    const rsiResult = rsiSignal(rsi);
    const macdResult = macdSignal(latestMacd, prevMacd);

    // Calculate strength and confidence
    const strength = this.calculateStrength(rsi, latestMacd, volumes);
    if (strength < this.config.minStrength) {
      return signals;
    }

    // Bullish momentum conditions
    if ((rsiResult.signal === 'LONG' || (rsi > 40 && rsi < 70)) &&
        (macdResult.signal === 'LONG' || latestMacd.histogram > 0)) {
      const signal: Signal = {
        id: generateId(),
        symbol: input.symbol,
        assetClass: input.assetClass,
        timeframe: input.timeframe,
        direction: 'LONG',
        strength,
        entryPrice: latestBar.close,
        stopLoss: latestBar.close - (this.calculateATR(lows, highs, closes) * 2),
        takeProfit: latestBar.close + (this.calculateATR(lows, highs, closes) * 3),
        riskRewardRatio: 1.5,
        source: 'momentum',
        indicators: {
          rsi: rsiResult,
          macd: macdResult,
        },
        reasons: this.generateReasons('LONG', rsi, latestMacd),
        regime: input.currentRegime,
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000, // 1 hour
        status: 'ACTIVE',
      };
      signals.push(signal);
    }

    // Bearish momentum conditions
    if ((rsiResult.signal === 'SHORT' || (rsi > 30 && rsi < 60)) &&
        (macdResult.signal === 'SHORT' || latestMacd.histogram < 0)) {
      const signal: Signal = {
        id: generateId(),
        symbol: input.symbol,
        assetClass: input.assetClass,
        timeframe: input.timeframe,
        direction: 'SHORT',
        strength,
        entryPrice: latestBar.close,
        stopLoss: latestBar.close + (this.calculateATR(lows, highs, closes) * 2),
        takeProfit: latestBar.close - (this.calculateATR(lows, highs, closes) * 3),
        riskRewardRatio: 1.5,
        source: 'momentum',
        indicators: {
          rsi: rsiResult,
          macd: macdResult,
        },
        reasons: this.generateReasons('SHORT', rsi, latestMacd),
        regime: input.currentRegime,
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000,
        status: 'ACTIVE',
      };
      signals.push(signal);
    }

    return signals;
  }

  private calculateStrength(rsi: number, macd: { histogram: number }, volumes: number[]): number {
    let strength = 0.5;

    // RSI contribution (strength away from 50)
    strength += Math.abs(rsi - 50) / 100;

    // MACD histogram contribution
    strength += Math.abs(macd.histogram) / 10;

    // Volume confirmation
    const recentVolumes = volumes.slice(-20);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    if (volumes[volumes.length - 1] > avgVolume * 1.2) {
      strength += 0.1;
    }

    return Math.min(1, strength);
  }

  private calculateATR(lows: number[], highs: number[], closes: number[]): number {
    const period = 14;
    const trueRanges: number[] = [];

    for (let i = 1; i < lows.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    if (trueRanges.length < period) return 0;

    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private generateReasons(direction: SignalDirection, rsi: number, macd: { histogram: number }): string[] {
    const reasons: string[] = [];

    if (direction === 'LONG') {
      if (rsi < 30) reasons.push(`RSI oversold at ${rsi.toFixed(1)}`);
      else if (rsi > 50) reasons.push(`RSI showing bullish momentum at ${rsi.toFixed(1)}`);
      if (macd.histogram > 0) reasons.push(`MACD histogram positive (${macd.histogram.toFixed(4)})`);
    } else {
      if (rsi > 70) reasons.push(`RSI overbought at ${rsi.toFixed(1)}`);
      else if (rsi < 50) reasons.push(`RSI showing bearish momentum at ${rsi.toFixed(1)}`);
      if (macd.histogram < 0) reasons.push(`MACD histogram negative (${macd.histogram.toFixed(4)})`);
    }

    return reasons;
  }
}
