/**
 * Mean Reversion Strategy
 * Identifies price extremes using Bollinger Bands and RSI
 * Trades return to the mean after extreme moves
 */

import type { Signal, SignalDirection, MarketRegime, Timeframe } from '@/types/signal.js';
import type { PriceBar } from '@/types/signal.js';
import { IndicatorResult } from '@/types/signal.js';
import type { StrategyInput } from './types.js';
import { calculateBollingerBands, calculateRSI, bollingerSignal, rsiSignal, calculateATR } from '../indicators/indicators.js';
import { generateId } from '@/utils/index.js';

export interface MeanReversionStrategyConfig {
  bbPeriod: number;
  bbStdDev: number;
  rsiPeriod: number;
  rsiExtremeOversold: number;
  rsiExtremeOverbought: number;
  minStrength: number;
}

const DEFAULT_CONFIG: MeanReversionStrategyConfig = {
  bbPeriod: 20,
  bbStdDev: 2,
  rsiPeriod: 14,
  rsiExtremeOversold: 25,
  rsiExtremeOverbought: 75,
  minStrength: 0.6,
};

export class MeanReversionStrategy {
  constructor(private config: MeanReversionStrategyConfig = DEFAULT_CONFIG) {}

  /**
   * Generate mean reversion signals
   */
  generate(input: StrategyInput): Signal[] {
    const signals: Signal[] = [];

    if (input.bars.length < this.config.bbPeriod + 10) {
      return signals; // Not enough data
    }

    const closes = input.bars.map(b => b.close);
    const highs = input.bars.map(b => b.high);
    const lows = input.bars.map(b => b.low);

    // Calculate indicators
    const bb = calculateBollingerBands(closes, this.config.bbPeriod, this.config.bbStdDev);
    const latestBB = bb[bb.length - 1];
    const rsi = calculateRSI(closes, this.config.rsiPeriod);

    const latestBar = input.bars[input.bars.length - 1];
    const now = Date.now();

    // Calculate position within bands (0 = lower band, 1 = upper band)
    const bandPosition = (latestBar.close - latestBB.lower) / (latestBB.upper - latestBB.lower);
    const bandPercentile = (latestBar.close - latestBB.lower) / (latestBB.upper - latestBB.lower);

    // RSI analysis
    const rsiResult = rsiSignal(rsi);
    const bbResult = bollingerSignal(latestBar.close, latestBB);

    // Calculate combined strength
    const strength = this.calculateStrength(bandPercentile, rsi, latestBB);
    if (strength < this.config.minStrength) {
      return signals;
    }

    const atr = this.calculateATRValue(lows, highs, closes);

    // Price at or below lower band with oversold RSI = BUY
    if (bandPercentile <= 0.1 && rsi < this.config.rsiExtremeOversold) {
      const signal: Signal = {
        id: generateId(),
        symbol: input.symbol,
        assetClass: input.assetClass,
        timeframe: input.timeframe,
        direction: 'LONG',
        strength,
        entryPrice: latestBar.close,
        stopLoss: latestBar.close - (atr * 1.5),
        takeProfit: latestBB.middle, // Target is the middle band (mean)
        riskRewardRatio: this.calculateRR(latestBar.close, latestBB.middle, atr * 1.5),
        source: 'meanReversion',
        indicators: {
          rsi: rsiResult,
          bollingerBands: bbResult,
        },
        reasons: this.generateReasons('LONG', bandPercentile, rsi, latestBB),
        regime: input.currentRegime,
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000, // 1 hour
        status: 'ACTIVE',
      };
      signals.push(signal);
    }

    // Price at or above upper band with overbought RSI = SELL
    if (bandPercentile >= 0.9 && rsi > this.config.rsiExtremeOverbought) {
      const signal: Signal = {
        id: generateId(),
        symbol: input.symbol,
        assetClass: input.assetClass,
        timeframe: input.timeframe,
        direction: 'SHORT',
        strength,
        entryPrice: latestBar.close,
        stopLoss: latestBar.close + (atr * 1.5),
        takeProfit: latestBB.middle, // Target is the middle band (mean)
        riskRewardRatio: this.calculateRR(latestBar.close, latestBB.middle, atr * 1.5),
        source: 'meanReversion',
        indicators: {
          rsi: rsiResult,
          bollingerBands: bbResult,
        },
        reasons: this.generateReasons('SHORT', bandPercentile, rsi, latestBB),
        regime: input.currentRegime,
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000,
        status: 'ACTIVE',
      };
      signals.push(signal);
    }

    return signals;
  }

  private calculateStrength(bandPercentile: number, rsi: number, bb: { upper: number; lower: number; middle: number }): number {
    let strength = 0.5;

    // Distance from band extremes
    if (bandPercentile <= 0.1) {
      strength += (0.1 - bandPercentile) * 5; // Up to 0.5 more for extreme position
    } else if (bandPercentile >= 0.9) {
      strength += (bandPercentile - 0.9) * 5;
    }

    // RSI confirmation
    if (rsi < 25) {
      strength += (25 - rsi) / 50; // Up to 0.5 more for extreme oversold
    } else if (rsi > 75) {
      strength += (rsi - 75) / 50;
    }

    return Math.min(1, strength);
  }

  private calculateATRValue(lows: number[], highs: number[], closes: number[]): number {
    const atrValues = calculateATR(highs, lows, closes, 14);
    return atrValues[atrValues.length - 1] || 0;
  }

  private calculateRR(entry: number, target: number, stopDistance: number): number {
    const profitDistance = Math.abs(target - entry);
    return profitDistance / stopDistance;
  }

  private generateReasons(
    direction: SignalDirection,
    bandPosition: number,
    rsi: number,
    bb: { upper: number; lower: number; middle: number }
  ): string[] {
    const reasons: string[] = [];

    if (direction === 'LONG') {
      reasons.push(`Price at lower Bollinger Band (${bandPosition < 0.05 ? 'extreme' : 'near'} oversold)`);
      if (rsi < 25) reasons.push(`RSI extremely oversold at ${rsi.toFixed(1)}`);
      else if (rsi < 30) reasons.push(`RSI oversold at ${rsi.toFixed(1)}`);
      reasons.push(`Target: middle band at ${bb.middle.toFixed(2)}`);
    } else {
      reasons.push(`Price at upper Bollinger Band (${bandPosition > 0.95 ? 'extreme' : 'near'} overbought)`);
      if (rsi > 75) reasons.push(`RSI extremely overbought at ${rsi.toFixed(1)}`);
      else if (rsi > 70) reasons.push(`RSI overbought at ${rsi.toFixed(1)}`);
      reasons.push(`Target: middle band at ${bb.middle.toFixed(2)}`);
    }

    return reasons;
  }
}
