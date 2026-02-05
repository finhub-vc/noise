/**
 * Trades Repository
 * Data access layer for trades
 */

import type { Trade, TradeStatus, CreateTradeInput } from '@/types/database.js';
import { generateId, createLogger } from '@/utils/index.js';
import type { DatabaseManager } from '../DatabaseManager.js';

const log = createLogger('TRADES_REPO');

export class TradesRepository {
  constructor(private db: DatabaseManager) {}

  async create(input: CreateTradeInput): Promise<Trade> {
    const id = generateId('trade');
    const now = Date.now();

    const trade: Trade = {
      id,
      symbol: input.symbol,
      assetClass: input.assetClass,
      broker: input.broker,
      clientOrderId: input.clientOrderId,
      brokerOrderId: null,
      side: input.side,
      quantity: input.quantity,
      orderType: input.orderType,
      limitPrice: input.limitPrice ?? null,
      stopPrice: input.stopPrice ?? null,
      status: 'PENDING',
      filledQuantity: 0,
      avgFillPrice: null,
      signalId: input.signalId ?? null,
      signalStrength: input.signalStrength ?? null,
      createdAt: now,
      filledAt: null,
      updatedAt: now,
    };

    await this.db.insert('trades', trade);
    log.info('Trade created', { tradeId: id, symbol: input.symbol });
    return trade;
  }

  async getById(id: string): Promise<Trade | null> {
    return await this.db.findById<Trade>('trades', id);
  }

  async getByClientOrderId(clientOrderId: string): Promise<Trade | null> {
    const sql = 'SELECT * FROM trades WHERE client_order_id = ?';
    return await this.db.db.prepare(sql).bind(clientOrderId).first() as Trade | null;
  }

  async getBySymbol(symbol: string, options?: {
    limit?: number;
    status?: TradeStatus;
  }): Promise<Trade[]> {
    let sql = 'SELECT * FROM trades WHERE symbol = ?';
    const params: unknown[] = [symbol];

    if (options?.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const result = await this.db.db.prepare(sql).bind(...params).all();
    return result.results as Trade[];
  }

  async updateStatus(
    id: string,
    status: TradeStatus,
    filledQuantity?: number,
    avgFillPrice?: number,
    brokerOrderId?: string
  ): Promise<void> {
    const updates: Partial<Trade> = {
      status,
      updatedAt: Date.now(),
    };

    if (filledQuantity !== undefined) updates.filledQuantity = filledQuantity;
    if (avgFillPrice !== undefined) updates.avgFillPrice = avgFillPrice;
    if (brokerOrderId !== undefined) updates.brokerOrderId = brokerOrderId;
    if (status === 'FILLED' && !updates.filledAt) updates.filledAt = Date.now();

    await this.db.update('trades', id, updates);
    log.info('Trade status updated', { tradeId: id, status });
  }

  async getTodayTrades(): Promise<Trade[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const timestamp = startOfDay.getTime();

    const sql = 'SELECT * FROM trades WHERE created_at >= ? ORDER BY created_at DESC';
    const result = await this.db.db.prepare(sql).bind(timestamp).all();
    return result.results as Trade[];
  }

  async getByDateRange(startDate: number, endDate: number): Promise<Trade[]> {
    const sql = 'SELECT * FROM trades WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC';
    const result = await this.db.db.prepare(sql).bind(startDate, endDate).all();
    return result.results as Trade[];
  }

  async getOpenOrders(): Promise<Trade[]> {
    const sql = `SELECT * FROM trades WHERE status IN ('PENDING', 'OPEN') ORDER BY created_at ASC`;
    const result = await this.db.db.prepare(sql).all();
    return result.results as Trade[];
  }
}
