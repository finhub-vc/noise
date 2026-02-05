/**
 * Breakout Strategy
 * Identifies price breakouts from consolidation using Bollinger squeeze and ADX
 * Trades breakouts with momentum confirmation
 */

import type { Signal, SignalDirection, MarketRegime, Timeframe } from '@/types/signal.js';
import type { PriceBar } from '@/types/signal.js';
import { IndicatorResult } from '@/types/signal.js';
import type { StrategyInput } from './types.js';
import { calculateBollingerBands, calculateADX, calculateATR, bollingerSignal, adxSignal } from '../indicators/indicators.js';
import { generateId } from '@/utils/index.js';

export interface BreakoutStrategyConfig {
  bbPeriod: number;
  bbStdDev: number;
  adxPeriod: number;
  adxTrendThreshold: number;
  atrPeriod: number;
  atrMultiplier: number;
  consolidationBars: number;
  minStrength: number;
}

const DEFAULT_CONFIG: BreakoutStrategyConfig = {
  bbPeriod: 20,
  bbStdDev: 2,
  adxPeriod: 14,
  adxTrendThreshold: 25,
  atrPeriod: 14,
  atrMultiplier: 2,
  consolidationBars: 10,
  minStrength: 0.6,
};

export class BreakoutStrategy {
  constructor(private config: BreakoutStrategyConfig = DEFAULT_CONFIG) {}

  /**
   * Generate breakout signals
   */
  generate(input: StrategyInput): Signal[] {
    const signals: Signal[] = [];

    if (input.bars.length < this.config.bbPeriod + this.config.consolidationBars) {
      return signals; // Not enough data
    }

    const closes = input.bars.map(b => b.close);
    const highs = input.bars.map(b => b.high);
    const lows = input.bars.map(b => b.low);

    // Calculate indicators
    const bb = calculateBollingerBands(closes, this.config.bbPeriod, this.config.bbStdDev);
    const latestBB = bb[bb.length - 1];
    const adxResults = calculateADX(highs, lows, closes, this.config.adxPeriod);
    const latestADX = adxResults[adxResults.length - 1];
    const atrValues = calculateATR(highs, lows, closes, this.config.atrPeriod);

    const latestBar = input.bars[input.bars.length - 1];
    const prevBar = input.bars[input.bars.length - 2];
    const now = Date.now();

    // Check for Bollinger Band squeeze (low volatility before breakout)
    const isSqueeze = this.detectSqueeze(bb.slice(-this.config.consolidationBars));
    const isExpanding = this.detectBandExpansion(bb.slice(-5));

    // Only trade on expansion after squeeze
    if (!isSqueeze && !isExpanding) {
      return signals;
    }

    // ADX analysis
    const adxResult = adxSignal(latestADX.adx, latestADX.pdi, latestADX.ndi);
    const bbResult = bollingerSignal(latestBar.close, latestBB);

    // Calculate strength
    const strength = this.calculateStrength(
      latestBB,
      latestADX.adx,
      atrValues,
      closes
    );

    if (strength < this.config.minStrength) {
      return signals;
    }

    const currentATR = atrValues[atrValues.length - 1] || 0;

    // Bullish breakout: price breaks above upper band with ADX confirmation
    if (latestBar.close > latestBB.upper &&
        prevBar.close <= bb[bb.length - 2].upper &&
        latestADX.pdi > latestADX.ndi &&
        latestADX.adx > this.config.adxTrendThreshold) {

      const signal: Signal = {
        id: generateId(),
        symbol: input.symbol,
        assetClass: input.assetClass,
        timeframe: input.timeframe,
        direction: 'LONG',
        strength,
        entryPrice: latestBar.close,
        stopLoss: latestBar.close - (currentATR * this.config.atrMultiplier),
        takeProfit: latestBar.close + (currentATR * this.config.atrMultiplier * 2),
        riskRewardRatio: 2.0,
        source: 'breakout',
        indicators: {
          bollingerBands: bbResult,
          adx: adxResult,
        },
        reasons: this.generateReasons('LONG', latestBB, latestADX, isSqueeze),
        regime: input.currentRegime,
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000, // 1 hour
        status: 'ACTIVE',
      };
      signals.push(signal);
    }

    // Bearish breakout: price breaks below lower band with ADX confirmation
    if (latestBar.close < latestBB.lower &&
        prevBar.close >= bb[bb.length - 2].lower &&
        latestADX.ndi > latestADX.pdi &&
        latestADX.adx > this.config.adxTrendThreshold) {

      const signal: Signal = {
        id: generateId(),
        symbol: input.symbol,
        assetClass: input.assetClass,
        timeframe: input.timeframe,
        direction: 'SHORT',
        strength,
        entryPrice: latestBar.close,
        stopLoss: latestBar.close + (currentATR * this.config.atrMultiplier),
        takeProfit: latestBar.close - (currentATR * this.config.atrMultiplier * 2),
        riskRewardRatio: 2.0,
        source: 'breakout',
        indicators: {
          bollingerBands: bbResult,
          adx: adxResult,
        },
        reasons: this.generateReasons('SHORT', latestBB, latestADX, isSqueeze),
        regime: input.currentRegime,
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000,
        status: 'ACTIVE',
      };
      signals.push(signal);
    }

    return signals;
  }

  /**
   * Detect Bollinger Band squeeze (low volatility period)
   */
  private detectSqueeze(bands: { bandwidth: number }[]): boolean {
    if (bands.length < this.config.consolidationBars) return false;

    const recentBandwidths = bands.slice(-this.config.consolidationBars).map(b => b.bandwidth);
    const avgBandwidth = recentBandwidths.reduce((a, b) => a + b, 0) / recentBandwidths.length;

    // Check if current bandwidth is significantly lower than recent average
    const currentBandwidth = recentBandwidths[recentBandwidths.length - 1];
    return currentBandwidth < avgBandwidth * 0.7;
  }

  /**
   * Detect Bollinger Band expansion (volatility increasing)
   */
  private detectBandExpansion(bands: { bandwidth: number }[]): boolean {
    if (bands.length < 3) return false;

    const recent = bands.slice(-3);
    // Bandwidth should be expanding
    return recent[2].bandwidth > recent[1].bandwidth &&
           recent[1].bandwidth > recent[0].bandwidth;
  }

  private calculateStrength(
    bb: { upper: number; lower: number; middle: number; bandwidth: number },
    adx: number,
    atrValues: number[],
    closes: number[]
  ): number {
    let strength = 0.4;

    // Bandwidth expansion contributes to strength
    if (bb.bandwidth > 0.02) {
      strength += 0.2;
    }

    // ADX strength (trend strength)
    if (adx > 40) {
      strength += 0.3;
    } else if (adx > 30) {
      strength += 0.2;
    } else if (adx > 25) {
      strength += 0.1;
    }

    // ATR expansion (volatility increasing)
    const recentATR = atrValues.slice(-5);
    const avgATR = recentATR.reduce((a, b) => a + b, 0) / recentATR.length;
    if (recentATR[recentATR.length - 1] > avgATR * 1.2) {
      strength += 0.1;
    }

    return Math.min(1, strength);
  }

  private generateReasons(
    direction: SignalDirection,
    bb: { upper: number; lower: number; bandwidth: number },
    adx: { adx: number; pdi: number; ndi: number },
    fromSqueeze: boolean
  ): string[] {
    const reasons: string[] = [];

    if (fromSqueeze) {
      reasons.push('Breakout from Bollinger Band squeeze');
    } else {
      reasons.push('Price breaking through Bollinger Bands');
    }

    if (direction === 'LONG') {
      reasons.push(`Price broke above upper band at ${bb.upper.toFixed(2)}`);
      reasons.push(`ADX showing strong uptrend (${adx.adx.toFixed(1)}, +DI > -DI)`);
    } else {
      reasons.push(`Price broke below lower band at ${bb.lower.toFixed(2)}`);
      reasons.push(`ADX showing strong downtrend (${adx.adx.toFixed(1)}, -DI > +DI)`);
    }

    reasons.push(`Bandwidth: ${(bb.bandwidth * 100).toFixed(2)}%`);

    return reasons;
  }
}
