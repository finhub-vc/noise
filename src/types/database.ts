/**
 * Database Types
 * TypeScript types matching the D1 database schema
 */

import type { AssetClass, BrokerType, OrderType as BrokerOrderType } from './broker.js';

// Re-export OrderType from broker for convenience
export type OrderType = BrokerOrderType;

// =============================================================================
// Trade Types
// =============================================================================

export type TradeStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
export type TradeSide = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  broker: BrokerType;
  clientOrderId: string;
  brokerOrderId: string | null;
  side: TradeSide;
  quantity: number;
  orderType: OrderType;
  limitPrice: number | null;
  stopPrice: number | null;
  status: TradeStatus;
  filledQuantity: number;
  avgFillPrice: number | null;
  signalId: string | null;
  signalStrength: number | null;
  createdAt: number; // Unix timestamp in ms
  filledAt: number | null;
  updatedAt: number;
}

export interface CreateTradeInput {
  symbol: string;
  assetClass: AssetClass;
  broker: BrokerType;
  clientOrderId: string;
  side: TradeSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  signalId?: string;
  signalStrength?: number;
}

// =============================================================================
// Position Types
// =============================================================================

export interface Position {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  broker: BrokerType;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// Trade History Types
// =============================================================================

export interface TradeHistory {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  broker: BrokerType;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  netPnl: number;
  pnlPercent: number;
  entryAt: number;
  exitAt: number;
  holdDurationMinutes: number;
  signalId: string | null;
  strategy: string | null;
}

// =============================================================================
// Signal Types
// =============================================================================

export interface DBSignal {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  source: string;
  indicators: string; // JSON string
  reasons: string; // JSON array string
  regime: string;
  timestamp: number;
  expiresAt: number;
  executedAt: number | null;
  cancelledAt: number | null;
  status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';
}

// =============================================================================
// Risk State Types
// =============================================================================

export interface DBRiskState {
  id: number; // Always 1 - singleton
  startOfDayEquity: number;
  startOfWeekEquity: number;
  peakEquity: number;
  currentEquity: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  weeklyPnl: number;
  weeklyPnlPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  todayTradeCount: number;
  circuitBreakerTriggered: boolean;
  circuitBreakerUntil: number | null;
  circuitBreakerReason: string | null;
  circuitBreakerType: string | null;
  dayTradesUsed: number;
  dayTradesRemaining: number;
  tradingDay: string;
  lastUpdated: number;
}

// =============================================================================
// Daily Metrics Types
// =============================================================================

export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  winRate: number;
  netPnl: number;
  pnlPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  equityStart: number;
  equityEnd: number;
}

// =============================================================================
// Equity Curve Types
// =============================================================================

export interface EquityCurve {
  timestamp: number;
  equity: number;
  cash: number;
  positionsValue: number;
  totalExposure: number;
  openPositions: number;
}

// =============================================================================
// Audit Log Types
// =============================================================================

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type AuditCategory = 'ORDER' | 'RISK' | 'SIGNAL' | 'BROKER' | 'SYSTEM' | 'AUTH' | 'CONFIG';

export interface AuditLog {
  id: string;
  timestamp: number;
  severity: AuditSeverity;
  category: AuditCategory;
  message: string;
  context: string; // JSON string
  relatedEntityId: string | null;
  relatedEntityType: string | null;
}

export interface CreateAuditLogInput {
  severity: AuditSeverity;
  category: AuditCategory;
  message: string;
  context?: Record<string, unknown>;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

// =============================================================================
// Migration Types
// =============================================================================

export interface Migration {
  id: number;
  name: string;
  executedAt: number | null;
}

// =============================================================================
// Query Result Types
// =============================================================================

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

export interface DateRangeOptions {
  startDate?: string | number;
  endDate?: string | number;
}

export interface PerformanceSummary {
  totalTrades: number;
  winsCount: number;
  lossesCount: number;
  winRate: number;
  netPnl: number;
  pnlPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}
