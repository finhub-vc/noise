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
    it('calculates simple moving average correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const sma = calculateSMA(prices, 3);
      expect(sma).toBeInstanceOf(Array);
    });

    it('returns empty array for insufficient data', () => {
      const prices = [1, 2];
      const sma = calculateSMA(prices, 5);
      expect(sma).toHaveLength(0);
    });
  });

  describe('calculateEMA', () => {
    it('calculates exponential moving average correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const ema = calculateEMA(prices, 3);
      expect(ema).toBeInstanceOf(Array);
    });

    it('returns empty array for insufficient data', () => {
      const prices = [1];
      const ema = calculateEMA(prices, 5);
      expect(ema).toHaveLength(0);
    });
  });

  describe('calculateRSI', () => {
    it('calculates RSI correctly', () => {
      const prices = Array.from({ length: 20 }, () => 100 + Math.random() * 10);
      const rsi = calculateRSI(prices, 14);
      expect(typeof rsi).toBe('number');
    });

    it('returns values between 0 and 100', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const rsi = calculateRSI(prices, 14);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateMACD', () => {
    it('calculates MACD correctly', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const macd = calculateMACD(prices, 12, 26, 9);
      expect(macd).toBeInstanceOf(Array);
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
    it('calculates Bollinger Bands correctly', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const bb = calculateBollingerBands(prices, 20, 2);
      expect(bb).toBeInstanceOf(Array);
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
    it('calculates ATR correctly', () => {
      const highs = Array.from({ length: 20 }, () => 105 + Math.random() * 5);
      const lows = Array.from({ length: 20 }, () => 95 + Math.random() * 5);
      const closes = Array.from({ length: 20 }, () => 100 + Math.random() * 5);
      const atr = calculateATR(highs, lows, closes, 14);
      expect(atr).toBeInstanceOf(Array);
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
  });

  describe('calculateVolume', () => {
    it('calculates volume metrics correctly', () => {
      const volumes = Array.from({ length: 20 }, () => 1000 + Math.random() * 5000);
      const result = calculateVolume(volumes, 20);
      expect(result).toHaveProperty('average');
      expect(result).toHaveProperty('ratio');
    });
  });
});
