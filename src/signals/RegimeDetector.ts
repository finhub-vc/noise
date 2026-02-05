/**
 * Regime Detector
 * Identifies current market regime (trending, ranging, volatility)
 * to help filter signals by preferred market conditions
 */

import type { MarketRegime, RegimeDetection, PriceBar } from '@/types/signal.js';
import { calculateADX, calculateATR, calculateEMA } from './indicators/indicators.js';

export interface RegimeDetectorConfig {
  adxPeriod: number;
  atrPeriod: number;
  atrLookback: number;
  trendPeriod: number;
  volatilityThreshold: number; // ATR percentile threshold for high volatility
}

const DEFAULT_CONFIG: RegimeDetectorConfig = {
  adxPeriod: 14,
  atrPeriod: 14,
  atrLookback: 100, // Look back 100 bars for percentile calculation
  trendPeriod: 50,
  volatilityThreshold: 80, // 80th percentile = high volatility
};

export class RegimeDetector {
  private atrHistory: number[] = [];

  constructor(private config: RegimeDetectorConfig = DEFAULT_CONFIG) {}

  /**
   * Detect the current market regime
   */
  detect(bars: PriceBar[]): RegimeDetection {
    if (bars.length < this.config.adxPeriod + this.config.trendPeriod) {
      return {
        regime: 'RANGING',
        adx: 0,
        atrPercentile: 50,
        trendStrength: 'none',
        volatilityLevel: 'normal',
        timestamp: Date.now(),
      };
    }

    const closes = bars.map(b => b.close);
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);

    // Calculate ADX for trend strength
    const adxResults = calculateADX(highs, lows, closes, this.config.adxPeriod);
    const latestADX = adxResults[adxResults.length - 1];

    // Calculate ATR for volatility
    const atrValues = calculateATR(highs, lows, closes, this.config.atrPeriod);
    const latestATR = atrValues[atrValues.length - 1] || 0;

    // Update ATR history for percentile calculation
    this.atrHistory.push(...atrValues.slice(-20));
    if (this.atrHistory.length > this.config.atrLookback) {
      this.atrHistory = this.atrHistory.slice(-this.config.atrLookback);
    }

    const atrPercentile = this.calculatePercentile(latestATR, this.atrHistory);

    // Determine trend direction using EMA
    const ema = calculateEMA(closes, this.config.trendPeriod);
    const latestEMA = ema[ema.length - 1];
    const prevEMA = ema[ema.length - 2];
    const currentPrice = closes[closes.length - 1];
    const trendStrength = this.determineTrendStrength(latestADX.adx, latestADX.pdi, latestADX.ndi);

    // Determine volatility level
    const volatilityLevel = this.determineVolatilityLevel(atrPercentile);

    // Determine regime
    const regime = this.determineRegime(
      latestADX.adx,
      latestADX.pdi,
      latestADX.ndi,
      currentPrice,
      latestEMA,
      prevEMA,
      atrPercentile
    );

    return {
      regime,
      adx: latestADX.adx,
      atrPercentile,
      trendStrength,
      volatilityLevel,
      timestamp: Date.now(),
    };
  }

  /**
   * Determine the primary market regime
   */
  private determineRegime(
    adx: number,
    pdi: number,
    ndi: number,
    price: number,
    ema: number,
    prevEma: number,
    atrPercentile: number
  ): MarketRegime {
    const isHighVolatility = atrPercentile > this.config.volatilityThreshold;
    const isLowVolatility = atrPercentile < 20;
    const isStrongTrend = adx >= 40;
    const isWeakTrend = adx >= 25 && adx < 40;
    const isRanging = adx < 25;
    const isBullish = pdi > ndi && price > ema;
    const isBearish = ndi > pdi && price < ema;

    // High volatility regime
    if (isHighVolatility) {
      return 'HIGH_VOLATILITY';
    }

    // Low volatility regime
    if (isLowVolatility && isRanging) {
      return 'LOW_VOLATILITY';
    }

    // Strong uptrend
    if (isStrongTrend && isBullish && ema > prevEma) {
      return 'STRONG_TREND_UP';
    }

    // Strong downtrend
    if (isStrongTrend && isBearish && ema < prevEma) {
      return 'STRONG_TREND_DOWN';
    }

    // Weak uptrend
    if (isWeakTrend && isBullish) {
      return 'WEAK_TREND_UP';
    }

    // Weak downtrend
    if (isWeakTrend && isBearish) {
      return 'WEAK_TREND_DOWN';
    }

    // Default: ranging market
    return 'RANGING';
  }

  /**
   * Determine trend strength category
   */
  private determineTrendStrength(adx: number, _pdi: number, _ndi: number): 'strong' | 'weak' | 'none' {
    if (adx >= 40) return 'strong';
    if (adx >= 25) return 'weak';
    return 'none';
  }

  /**
   * Determine volatility level category
   */
  private determineVolatilityLevel(atrPercentile: number): 'high' | 'normal' | 'low' {
    if (atrPercentile > this.config.volatilityThreshold) return 'high';
    if (atrPercentile < 20) return 'low';
    return 'normal';
  }

  /**
   * Calculate percentile of a value within a historical array
   */
  private calculatePercentile(value: number, history: number[]): number {
    if (history.length === 0) return 50;

    const sorted = [...history].sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= value).length;
    return (rank / sorted.length) * 100;
  }

  /**
   * Check if a regime is suitable for a particular strategy
   */
  isRegimeSuitable(regime: MarketRegime, strategy: 'momentum' | 'meanReversion' | 'breakout'): boolean {
    const momentumRegimes = [
      'STRONG_TREND_UP',
      'STRONG_TREND_DOWN',
      'WEAK_TREND_UP',
      'WEAK_TREND_DOWN',
    ];

    const meanReversionRegimes = [
      'RANGING',
      'LOW_VOLATILITY',
    ];

    const breakoutRegimes = [
      'LOW_VOLATILITY',
      'RANGING',
    ];

    switch (strategy) {
      case 'momentum':
        return momentumRegimes.includes(regime);
      case 'meanReversion':
        return meanReversionRegimes.includes(regime);
      case 'breakout':
        return breakoutRegimes.includes(regime);
      default:
        return true;
    }
  }
}
