/**
 * Risk State Repository
 * Data access layer for risk state (singleton table)
 */

import type { DBRiskState } from '@/types/database.js';
import { createLogger } from '@/utils/index.js';
import type { DatabaseManager } from '../DatabaseManager.js';

const log = createLogger('RISK_STATE_REPO');

// Ensure risk_state always has id=1
const SINGLETON_ID = 1;

export class RiskStateRepository {
  constructor(private db: DatabaseManager) {}

  async get(): Promise<DBRiskState | null> {
    const sql = 'SELECT * FROM risk_state WHERE id = ?';
    const result = await this.db.db.prepare(sql).bind(SINGLETON_ID).first();
    return (result as DBRiskState | null) ?? null;
  }

  async update(updates: Partial<Omit<DBRiskState, 'id'>>): Promise<void> {
    const keys = Object.keys(updates) as (keyof typeof updates)[];
    const values = Object.values(updates);

    if (keys.length === 0) return;

    const setClause = keys.map((k) => `${toSnakeCase(k)} = ?`).join(', ');
    const sql = `UPDATE risk_state SET ${setClause}, last_updated = ? WHERE id = ?`;

    await this.db.execute(sql, [...values, Date.now(), SINGLETON_ID]);
    log.debug('Risk state updated', { keys });
  }

  async getCurrentEquity(): Promise<number> {
    const state = await this.get();
    return state?.currentEquity ?? 0;
  }

  async getDailyPnl(): Promise<{ pnl: number; percent: number }> {
    const state = await this.get();
    return {
      pnl: state?.dailyPnl ?? 0,
      percent: state?.dailyPnlPercent ?? 0,
    };
  }

  async getCircuitBreakerStatus(): Promise<{
    triggered: boolean;
    until: number | null;
    reason: string | null;
  }> {
    const state = await this.get();
    return {
      triggered: state?.circuitBreakerTriggered ?? false,
      until: state?.circuitBreakerUntil ?? null,
      reason: state?.circuitBreakerReason ?? null,
    };
  }

  async setCircuitBreaker(
    triggered: boolean,
    reason: string | null,
    until: number | null,
    type: string | null = null
  ): Promise<void> {
    await this.update({
      circuitBreakerTriggered: triggered,
      circuitBreakerReason: reason,
      circuitBreakerUntil: until,
      circuitBreakerType: type,
    });

    if (triggered) {
      log.warn('Circuit breaker triggered', { reason, until });
    } else {
      log.info('Circuit breaker reset');
    }
  }

  async resetDailyState(startOfDayEquity: number): Promise<void> {
    await this.update({
      startOfDayEquity,
      dailyPnl: 0,
      dailyPnlPercent: 0,
      consecutiveLosses: 0,
      todayTradeCount: 0,
    });

    log.info('Daily risk state reset', { startOfDayEquity });
  }

  async resetWeeklyState(startOfWeekEquity: number): Promise<void> {
    await this.update({
      startOfWeekEquity,
      weeklyPnl: 0,
      weeklyPnlPercent: 0,
    });

    log.info('Weekly risk state reset', { startOfWeekEquity });
  }

  async updateEquity(currentEquity: number): Promise<void> {
    const state = await this.get();
    if (!state) return;

    const updates: Partial<DBRiskState> = { currentEquity };

    // Update peak equity
    if (currentEquity > (state.peakEquity || 0)) {
      updates.peakEquity = currentEquity;
    }

    // Calculate drawdown
    const drawdown = state.peakEquity > 0
      ? state.peakEquity - currentEquity
      : 0;
    const drawdownPercent = state.peakEquity > 0
      ? (drawdown / state.peakEquity) * 100
      : 0;

    updates.maxDrawdown = Math.max(state.maxDrawdown || 0, drawdown);
    updates.maxDrawdownPercent = Math.max(state.maxDrawdownPercent || 0, drawdownPercent);

    await this.update(updates);
  }

  async updatePnl(dailyPnl: number, weeklyPnl: number): Promise<void> {
    const state = await this.get();
    if (!state) return;

    const startOfDayEquity = state.startOfDayEquity || state.currentEquity || 1;
    const startOfWeekEquity = state.startOfWeekEquity || state.currentEquity || 1;

    await this.update({
      dailyPnl,
      dailyPnlPercent: (dailyPnl / startOfDayEquity) * 100,
      weeklyPnl,
      weeklyPnlPercent: (weeklyPnl / startOfWeekEquity) * 100,
    });
  }

  async incrementConsecutiveLosses(): Promise<void> {
    const state = await this.get();
    const current = state?.consecutiveLosses || 0;
    await this.update({
      consecutiveLosses: current + 1,
      consecutiveWins: 0,
    });
  }

  async incrementConsecutiveWins(): Promise<void> {
    const state = await this.get();
    const current = state?.consecutiveWins || 0;
    await this.update({
      consecutiveWins: current + 1,
      consecutiveLosses: 0,
    });
  }

  async updatePdtInfo(dayTradesUsed: number, dayTradesRemaining: number): Promise<void> {
    await this.update({
      dayTradesUsed,
      dayTradesRemaining,
    });
  }
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
