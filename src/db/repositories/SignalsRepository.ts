/**
 * Signals Repository
 * Data access layer for trading signals
 */

import type { DBSignal } from '@/types/database.js';
import type { Signal } from '@/types/signal.js';
import { generateId, createLogger } from '@/utils/index.js';
import type { DatabaseManager } from '../DatabaseManager.js';

const log = createLogger('SIGNALS_REPO');

export class SignalsRepository {
  constructor(private db: DatabaseManager) {}

  async create(signal: Omit<Signal, 'id' | 'status'>): Promise<DBSignal> {
    const id = generateId('signal');

    const dbSignal: DBSignal = {
      id,
      symbol: signal.symbol,
      assetClass: signal.assetClass,
      timeframe: signal.timeframe,
      direction: signal.direction,
      strength: signal.strength,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit ?? null,
      riskRewardRatio: signal.riskRewardRatio ?? null,
      source: signal.source,
      indicators: JSON.stringify(signal.indicators),
      reasons: JSON.stringify(signal.reasons),
      regime: signal.regime,
      timestamp: signal.timestamp,
      expiresAt: signal.expiresAt,
      executedAt: signal.executedAt ?? null,
      cancelledAt: signal.cancelledAt ?? null,
      status: 'ACTIVE',
    };

    await this.db.insert('signals', dbSignal as unknown as Record<string, unknown>);
    log.info('Signal created', { signalId: id, symbol: signal.symbol, direction: signal.direction });
    return dbSignal;
  }

  async getById(id: string): Promise<DBSignal | null> {
    return await this.db.findById<DBSignal>('signals', id);
  }

  async getActiveSignals(): Promise<DBSignal[]> {
    const now = Date.now();
    const sql = `
      SELECT * FROM signals
      WHERE status = 'ACTIVE' AND expires_at > ?
      ORDER BY timestamp DESC
    `;
    const result = await this.db.db.prepare(sql).bind(now).all();
    return result.results as unknown as DBSignal[];
  }

  async getActiveSignalsForSymbol(symbol: string): Promise<DBSignal[]> {
    const now = Date.now();
    const sql = `
      SELECT * FROM signals
      WHERE symbol = ? AND status = 'ACTIVE' AND expires_at > ?
      ORDER BY timestamp DESC
    `;
    const result = await this.db.db.prepare(sql).bind(symbol, now).all();
    return result.results as unknown as DBSignal[];
  }

  async markExecuted(id: string): Promise<void> {
    await this.db.update('signals', id, {
      executedAt: Date.now(),
      status: 'EXECUTED' as const,
    } as unknown as Record<string, unknown>);
    log.info('Signal marked executed', { signalId: id });
  }

  async markCancelled(id: string): Promise<void> {
    await this.db.update('signals', id, {
      cancelledAt: Date.now(),
      status: 'CANCELLED' as const,
    } as unknown as Record<string, unknown>);
    log.info('Signal marked cancelled', { signalId: id });
  }

  async expireOldSignals(): Promise<number> {
    const now = Date.now();
    const sql = `
      UPDATE signals
      SET status = 'EXPIRED'
      WHERE status = 'ACTIVE' AND expires_at < ?
    `;
    const result = await this.db.execute(sql, [now]);
    return result.meta?.changes ?? 0;
  }

  async getBySymbol(
    symbol: string,
    options?: { limit?: number; startDate?: number; endDate?: number }
  ): Promise<DBSignal[]> {
    let sql = 'SELECT * FROM signals WHERE symbol = ?';
    const params: unknown[] = [symbol];

    if (options?.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(options.startDate);
    }

    if (options?.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const result = await this.db.db.prepare(sql).bind(...params).all();
    return result.results as unknown as DBSignal[];
  }

  async getByStrategy(strategy: string, options?: { limit?: number }): Promise<DBSignal[]> {
    let sql = 'SELECT * FROM signals WHERE source = ? ORDER BY timestamp DESC';
    const params: unknown[] = [strategy];

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const result = await this.db.db.prepare(sql).bind(...params).all();
    return result.results as unknown as DBSignal[];
  }
}
