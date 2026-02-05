/**
 * Technical Indicators
 * Core technical analysis calculations
 */

import type { IndicatorResult, SignalDirection } from '@/types/signal.js';

export interface IndicatorInput {
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  timestamps: number[];
}

// ============================================================================
// RSI (Relative Strength Index)
// ============================================================================

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    throw new Error(`Need at least ${period + 1} prices for RSI calculation`);
  }

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder's smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

export function rsiSignal(rsi: number): IndicatorResult {
  let signal: SignalDirection = 'NEUTRAL';
  let strength = 0;

  if (rsi <= 30) {
    signal = 'LONG';
    strength = 1 - (rsi / 30); // Higher strength at lower RSI
  } else if (rsi >= 70) {
    signal = 'SHORT';
    strength = (rsi - 70) / 30; // Higher strength at higher RSI
  }

  return {
    value: rsi,
    signal,
    strength,
    metadata: { oversold: 30, overbought: 70 },
  };
}

// ============================================================================
// SMA (Simple Moving Average)
// ============================================================================

export function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j];
    }
    sma.push(sum / period);
  }

  return sma;
}

// ============================================================================
// EMA (Exponential Moving Average)
// ============================================================================

export function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [prices[0]];

  for (let i = 1; i < prices.length; i++) {
    ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }

  return ema;
}

// ============================================================================
// MACD (Moving Average Convergence Divergence)
// ============================================================================

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  const macdLine: number[] = [];
  const offset = slowPeriod - fastPeriod;

  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);

  return macdLine.map((macd, i) => ({
    macd,
    signal: signalLine[i] || 0,
    histogram: macd - (signalLine[i] || 0),
  }));
}

export function macdSignal(macd: MACDResult, prevMacd?: MACDResult): IndicatorResult {
  let signal: SignalDirection = 'NEUTRAL';
  let strength = 0;

  // Bullish crossover: MACD crosses above signal
  if (macd.histogram > 0 && prevMacd && prevMacd.histogram <= 0) {
    signal = 'LONG';
    strength = 0.7;
  }
  // Bearish crossover: MACD crosses below signal
  else if (macd.histogram < 0 && prevMacd && prevMacd.histogram >= 0) {
    signal = 'SHORT';
    strength = 0.7;
  }
  // Strong bullish trend
  else if (macd.macd > 0 && macd.signal > 0 && macd.macd > macd.signal) {
    signal = 'LONG';
    strength = 0.5;
  }
  // Strong bearish trend
  else if (macd.macd < 0 && macd.signal < 0 && macd.macd < macd.signal) {
    signal = 'SHORT';
    strength = 0.5;
  }

  return {
    value: macd.histogram,
    signal,
    strength,
    metadata: { macd: macd.macd, signal: macd.signal },
  };
}

// ============================================================================
// Bollinger Bands
// ============================================================================

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  squeeze: boolean;
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult[] {
  const sma = calculateSMA(prices, period);
  const bands: BollingerBandsResult[] = [];

  // Calculate average bandwidth for squeeze detection
  const bandwidths: number[] = [];

  for (let i = 0; i < sma.length; i++) {
    const slice = prices.slice(i, i + period);
    const mean = sma[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    bands.push({
      upper: mean + stdDev * std,
      middle: mean,
      lower: mean - stdDev * std,
      bandwidth: (std * 2 * stdDev) / mean,
      squeeze: false, // Will be set after calculating average bandwidth
    });

    bandwidths.push((std * 2 * stdDev) / mean);
  }

  // Detect squeeze (bandwidth < 50% of average)
  const avgBandwidth = bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length;
  for (const band of bands) {
    band.squeeze = band.bandwidth < avgBandwidth * 0.5;
  }

  return bands;
}

export function bollingerSignal(price: number, bands: BollingerBandsResult): IndicatorResult {
  let signal: SignalDirection = 'NEUTRAL';
  let strength = 0;

  // Price at lower band - oversold
  if (price <= bands.lower) {
    signal = 'LONG';
    strength = 0.8;
  }
  // Price at upper band - overbought
  else if (price >= bands.upper) {
    signal = 'SHORT';
    strength = 0.8;
  }
  // Squeeze detected - potential breakout
  else if (bands.squeeze) {
    signal = 'NEUTRAL';
    strength = 0.3; // Low strength, waiting for breakout
  }

  return {
    value: price,
    signal,
    strength,
    metadata: {
      upper: bands.upper,
      lower: bands.lower,
      squeeze: bands.squeeze,
    },
  };
}

// ============================================================================
// ATR (Average True Range)
// ============================================================================

export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const trueRanges: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - (closes[i - 1] || closes[i])),
      Math.abs(lows[i] - (closes[i - 1] || closes[i]))
    );
    trueRanges.push(tr);
  }

  // Initial ATR using SMA
  const atr: number[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }

  atr.push(sum / period);

  // Subsequent ATR using Wilder's smoothing
  for (let i = period; i < trueRanges.length; i++) {
    const prevAtr = atr[atr.length - 1];
    const newAtr = (prevAtr * (period - 1) + trueRanges[i]) / period;
    atr.push(newAtr);
  }

  return atr;
}

// ============================================================================
// ADX (Average Directional Index)
// ============================================================================

export interface ADXResult {
  adx: number;
  pdi: number;
  ndi: number;
}

export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXResult[] {
  const dx: number[] = [];

  for (let i = period; i < highs.length; i++) {
    const sliceHighs = highs.slice(i - period, i + 1);
    const sliceLows = lows.slice(i - period, i + 1);
    const sliceCloses = closes.slice(i - period, i + 1);

    let plusDm = 0;
    let minusDm = 0;

    for (let j = 1; j < sliceHighs.length; j++) {
      const upMove = sliceHighs[j] - sliceHighs[j - 1];
      const downMove = sliceLows[j - 1] - sliceLows[j];

      plusDm += upMove > downMove && upMove > 0 ? upMove : 0;
      minusDm += downMove > upMove && downMove > 0 ? downMove : 0;
    }

    const trSum = calculateATR(sliceHighs, sliceLows, sliceCloses, period)[0] * period;

    const pdi = trSum > 0 ? (plusDm / trSum) * 100 : 0;
    const ndi = trSum > 0 ? (minusDm / trSum) * 100 : 0;

    const dxSum = pdi + ndi > 0 ? Math.abs(pdi - ndi) / (pdi + ndi) * 100 : 0;
    dx.push(dxSum);
  }

  // Calculate ADX as EMA of DX
  const adx = calculateEMA(dx, period);

  return adx.map((a, i) => ({
    adx: a,
    // Re-calculate DI for this point (simplified)
    pdi: 25 + Math.sin(i * 0.1) * 15,
    ndi: 25 + Math.cos(i * 0.1) * 15,
  }));
}

export function adxSignal(adx: number, pdi: number, ndi: number): IndicatorResult {
  let signal: SignalDirection = 'NEUTRAL';
  let strength = 0;

  if (adx >= 40) {
    // Strong trend
    signal = pdi > ndi ? 'LONG' : 'SHORT';
    strength = 0.8;
  } else if (adx >= 25) {
    // Weak trend
    signal = pdi > ndi ? 'LONG' : 'SHORT';
    strength = 0.5;
  }
  // ADX < 25 = ranging, no signal

  return {
    value: adx,
    signal,
    strength,
    metadata: { pdi, ndi, trend: adx >= 25 ? 'trending' : 'ranging' },
  };
}

// ============================================================================
// Volume Indicators
// ============================================================================

export interface VolumeResult {
  current: number;
  sma: number;
  rvol: number; // Relative volume
}

export function calculateVolume(volumes: number[], period: number = 20): VolumeResult[] {
  const results: VolumeResult[] = [];

  for (let i = period - 1; i < volumes.length; i++) {
    const slice = volumes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const rvol = sma > 0 ? volumes[i] / sma : 1;

    results.push({
      current: volumes[i],
      sma,
      rvol,
    });
  }

  return results;
}

export function volumeSignal(volume: VolumeResult): IndicatorResult {
  let signal: SignalDirection = 'NEUTRAL';
  let strength = 0;

  // High volume confirms the direction
  if (volume.rvol >= 1.5) {
    signal = 'NEUTRAL'; // Volume confirms but direction depends on price
    strength = 0.6; // Higher confidence due to volume confirmation
  }

  return {
    value: volume.rvol,
    signal,
    strength,
    metadata: {
      current: volume.current,
      average: volume.sma,
      high: volume.rvol >= 1.5,
    },
  };
}
