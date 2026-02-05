/**
 * Positions Repository
 * Data access layer for positions
 */

import type { Position } from '@/types/database.js';
import { generateId, createLogger } from '@/utils/index.js';
import type { DatabaseManager } from '../DatabaseManager.js';

const log = createLogger('POSITIONS_REPO');

export class PositionsRepository {
  constructor(private db: DatabaseManager) {}

  async upsert(position: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>): Promise<Position> {
    const existing = await this.getBySymbol(position.symbol);

    if (existing) {
      const updated: Position = {
        ...existing,
        quantity: position.quantity,
        currentPrice: position.currentPrice,
        marketValue: position.marketValue,
        unrealizedPnl: position.unrealizedPnl,
        realizedPnl: position.realizedPnl ?? existing.realizedPnl,
        updatedAt: Date.now(),
      };

      await this.db.update('positions', existing.id, updated);
      return updated;
    }

    const newPosition: Position = {
      id: generateId('position'),
      symbol: position.symbol,
      assetClass: position.assetClass,
      broker: position.broker,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      marketValue: position.marketValue,
      unrealizedPnl: position.unrealizedPnl,
      realizedPnl: position.realizedPnl ?? 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.insert('positions', newPosition);
    log.info('Position created', { positionId: newPosition.id, symbol: position.symbol });
    return newPosition;
  }

  async getById(id: string): Promise<Position | null> {
    return await this.db.findById<Position>('positions', id);
  }

  async getBySymbol(symbol: string): Promise<Position | null> {
    const sql = 'SELECT * FROM positions WHERE symbol = ?';
    const result = await this.db.db.prepare(sql).bind(symbol).first();
    return (result as Position | null) ?? null;
  }

  async getAll(): Promise<Position[]> {
    const sql = 'SELECT * FROM positions ORDER BY symbol';
    const result = await this.db.db.prepare(sql).all();
    return result.results as Position[];
  }

  async getByBroker(broker: string): Promise<Position[]> {
    const sql = 'SELECT * FROM positions WHERE broker = ? ORDER BY symbol';
    const result = await this.db.db.prepare(sql).bind(broker).all();
    return result.results as Position[];
  }

  async getByAssetClass(assetClass: string): Promise<Position[]> {
    const sql = 'SELECT * FROM positions WHERE asset_class = ? ORDER BY symbol';
    const result = await this.db.db.prepare(sql).bind(assetClass).all();
    return result.results as Position[];
  }

  async delete(symbol: string): Promise<void> {
    const sql = 'DELETE FROM positions WHERE symbol = ?';
    await this.db.execute(sql, [symbol]);
    log.info('Position deleted', { symbol });
  }

  async deleteAll(): Promise<void> {
    const sql = 'DELETE FROM positions';
    await this.db.execute(sql);
    log.info('All positions deleted');
  }

  async getCorrelatedPositions(symbols: string[]): Promise<Position[]> {
    if (symbols.length === 0) return [];

    const placeholders = symbols.map(() => '?').join(',');
    const sql = `SELECT * FROM positions WHERE symbol IN (${placeholders})`;
    const result = await this.db.db.prepare(sql).bind(...symbols).all();
    return result.results as Position[];
  }
}
