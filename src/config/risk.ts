/**
 * Risk Configuration
 * Default risk management parameters for the NOISE trading engine
 */

import type { RiskConfig, CorrelationGroup } from '@/types/risk.js';

// =============================================================================
// Correlation Groups
// =============================================================================

export const CORRELATION_GROUPS: Record<string, CorrelationGroup> = {
  NASDAQ: {
    name: 'NASDAQ',
    symbols: ['MNQ', 'TQQQ', 'QQQ', 'NQ'],
    maxConcentration: 0.50,
  },
  SP500: {
    name: 'S&P 500',
    symbols: ['MES', 'SPY', 'SPXL', 'ES'],
    maxConcentration: 0.50,
  },
  SEMICONDUCTORS: {
    name: 'SEMICONDUCTORS',
    symbols: ['SOXL', 'SMH', 'NVDA', 'AMD'],
    maxConcentration: 0.40,
  },
  RUSSELL: {
    name: 'RUSSELL',
    symbols: ['M2K', 'IWM', 'TNA', 'RTY'],
    maxConcentration: 0.40,
  },
  CRUDE_OIL: {
    name: 'CRUDE OIL',
    symbols: ['MCL', 'CL', 'USO'],
    maxConcentration: 0.30,
  },
  GOLD: {
    name: 'GOLD',
    symbols: ['MGC', 'GC', 'GLD'],
    maxConcentration: 0.30,
  },
};

// =============================================================================
// Default Risk Configuration
// =============================================================================

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  // Position risk
  maxRiskPerTradePercent: 2, // Max 2% account risk per trade
  maxPositionPercent: 20, // Max 20% of account in single position
  maxOrderValue: 50000, // Max order size
  minOrderValue: 100, // Min order size

  // Portfolio risk
  maxDailyLossPercent: 5, // Halt trading after 5% daily loss
  maxWeeklyLossPercent: 10, // Halt trading after 10% weekly loss
  maxDrawdownPercent: 15, // Halt trading after 15% drawdown from peak
  maxConcurrentPositions: 10, // Max 10 open positions
  maxTotalExposurePercent: 200, // Allow 2x total exposure (leverage)
  maxFuturesExposurePercent: 150, // Max 150% in futures
  maxEquitiesExposurePercent: 100, // Max 100% in equities

  // Correlation risk
  maxCorrelatedConcentration: 0.40, // Max 40% in correlated group
  correlationGroups: CORRELATION_GROUPS,

  // Circuit breakers
  consecutiveLossLimit: 5, // 5 consecutive losses triggers cooldown
  cooldownMinutes: 60, // 1 hour cooldown

  // PDT
  pdtReserveDayTrades: 1, // Reserve 1 day trade
};

// =============================================================================
// Environment-specific overrides
// =============================================================================

export function getRiskConfig(env: string = 'development'): RiskConfig {
  const config = { ...DEFAULT_RISK_CONFIG };

  if (env === 'production') {
    // Production can use full risk parameters
    return config;
  }

  // Development uses more conservative limits
  return {
    ...config,
    maxOrderValue: 1000,
    maxConcurrentPositions: 3,
    maxTotalExposurePercent: 100,
    maxFuturesExposurePercent: 50,
    maxEquitiesExposurePercent: 50,
  };
}
