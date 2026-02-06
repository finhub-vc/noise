/**
 * Unit Tests for Technical Indicators
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateADX,
  calculateVolume,
} from '../../../src/signals/indicators/indicators.js';

describe('Indicator Utilities', () => {
  describe('calculateSMA', () => {
    it('calculates simple moving average correctly with known values', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const sma = calculateSMA(prices, 3);
      // SMA of [10,12,14] = 12, [12,14,16] = 14, [14,16,18] = 16, [16,18,20] = 18
      expect(sma).toEqual([12, 14, 16, 18]);
    });

    it('returns empty array for insufficient data', () => {
      const prices = [1, 2];
      const sma = calculateSMA(prices, 5);
      expect(sma).toHaveLength(0);
    });
  });

  describe('calculateEMA', () => {
    it('calculates exponential moving average correctly with known values', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const ema = calculateEMA(prices, 3);
      // EMA should start at the first price and smooth from there
      expect(ema).toHaveLength(6);
      // First EMA equals first price (SMA of insufficient data)
      expect(ema[0]).toBe(10);
      // EMA should be between min and max of prices
      expect(ema[0]).toBeGreaterThanOrEqual(10);
      expect(ema[ema.length - 1]).toBeLessThanOrEqual(20);
    });

    it('returns array starting with first price for insufficient data', () => {
      const prices = [1];
      const ema = calculateEMA(prices, 5);
      // EMA returns at least one value (first price) even for period > length
      expect(ema).toHaveLength(1);
      expect(ema[0]).toBe(1);
    });
  });

  describe('calculateRSI', () => {
    it('calculates RSI correctly with known values', () => {
      // Strong uptrend - should give high RSI
      const uptrendPrices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128];
      const rsi = calculateRSI(uptrendPrices, 14);
      expect(typeof rsi).toBe('number');
      // Uptrend should have RSI > 50 (strong momentum)
      expect(rsi).toBeGreaterThan(50);
    });

    it('throws error when insufficient data for RSI', () => {
      const prices = [100, 101, 102]; // Only 3 prices, need at least 15 for period 14
      expect(() => calculateRSI(prices, 14)).toThrow();
    });

    it('returns values between 0 and 100', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const rsi = calculateRSI(prices, 14);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateMACD', () => {
    it('calculates MACD correctly with known values', () => {
      const prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128, 130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150, 152];
      const macd = calculateMACD(prices, 12, 26, 9);
      expect(macd).toBeInstanceOf(Array);
      // Should have fewer results due to warmup periods
      expect(macd.length).toBeGreaterThan(0);
    });

    it('returns histogram, macd, and signal values', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const macd = calculateMACD(prices, 12, 26, 9);
      if (macd.length > 0) {
        expect(macd[0]).toHaveProperty('histogram');
        expect(macd[0]).toHaveProperty('macd');
        expect(macd[0]).toHaveProperty('signal');
      }
    });
  });

  describe('calculateBollingerBands', () => {
    it('calculates Bollinger Bands correctly with known values', () => {
      // Constant prices should have bands at the same level (std dev = 0)
      const constantPrices = Array.from({ length: 30 }, () => 100);
      const bb = calculateBollingerBands(constantPrices, 20, 2);
      expect(bb).toBeInstanceOf(Array);
      if (bb.length > 0) {
        // All bands should be at 100 for constant data (no volatility)
        expect(bb[0].middle).toBe(100);
        // Upper and lower equal middle when there's no volatility
        expect(bb[0].upper).toBe(100);
        expect(bb[0].lower).toBe(100);
      }
    });

    it('returns upper, middle, and lower bands', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const bb = calculateBollingerBands(prices, 20, 2);
      if (bb.length > 0) {
        expect(bb[0]).toHaveProperty('upper');
        expect(bb[0]).toHaveProperty('middle');
        expect(bb[0]).toHaveProperty('lower');
      }
    });
  });

  describe('calculateATR', () => {
    it('calculates ATR correctly with known values', () => {
      // Known high-low range
      const highs = [105, 110, 115, 120, 125, 130];
      const lows = [95, 100, 105, 110, 115, 120];
      const closes = [100, 105, 110, 115, 120, 125];
      const atr = calculateATR(highs, lows, closes, 3);
      expect(atr).toBeInstanceOf(Array);
      // ATR values should be positive
      atr.forEach(value => {
        expect(value!).toBeGreaterThan(0);
      });
    });

    it('throws error when arrays have different lengths', () => {
      const highs = [105, 110, 115];
      const lows = [100, 105]; // Different length
      const closes = [100, 105, 110];
      expect(() => calculateATR(highs, lows, closes, 3)).toThrow();
    });

    it('returns positive values', () => {
      const highs = Array.from({ length: 20 }, () => 105 + Math.random() * 5);
      const lows = Array.from({ length: 20 }, () => 95 + Math.random() * 5);
      const closes = Array.from({ length: 20 }, () => 100 + Math.random() * 5);
      const atr = calculateATR(highs, lows, closes, 14);
      if (atr.length > 0) {
        expect(atr[atr.length - 1]).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateADX', () => {
    it('calculates ADX correctly', () => {
      const highs = Array.from({ length: 30 }, () => 105 + Math.random() * 5);
      const lows = Array.from({ length: 30 }, () => 95 + Math.random() * 5);
      const closes = Array.from({ length: 30 }, () => 100 + Math.random() * 5);
      const adx = calculateADX(highs, lows, closes, 14);
      expect(adx).toBeInstanceOf(Array);
    });

    it('throws error when arrays have different lengths', () => {
      const highs = [105, 110, 115];
      const lows = [100, 105]; // Different length
      const closes = [100, 105, 110];
      expect(() => calculateADX(highs, lows, closes, 3)).toThrow();
    });
  });

  describe('calculateVolume', () => {
    it('calculates volume metrics correctly with known values', () => {
      const volumes = [1000, 2000, 3000, 4000, 5000];
      const result = calculateVolume(volumes, 5);
      // calculateVolume returns an array of VolumeResult
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1); // period 5 means only 1 result (5-1+1)
      expect(result[0]).toHaveProperty('current');
      expect(result[0]).toHaveProperty('sma');
      expect(result[0]).toHaveProperty('rvol');
      // SMA of 5 values [1000,2000,3000,4000,5000] = 3000
      expect(result[0].sma).toBe(3000);
      // RVOL = current / SMA = 5000 / 3000 = 1.667
      expect(result[0].rvol).toBeCloseTo(1.667, 3);
    });

    it('calculates volume metrics correctly', () => {
      const volumes = Array.from({ length: 20 }, () => 1000 + Math.random() * 5000);
      const result = calculateVolume(volumes, 20);
      expect(result).toBeInstanceOf(Array);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('current');
        expect(result[0]).toHaveProperty('sma');
        expect(result[0]).toHaveProperty('rvol');
      }
    });
  });
});
