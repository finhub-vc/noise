/**
 * Database Manager
 * Wrapper for Cloudflare D1 database operations
 */

import { createLogger } from '@/utils/index.js';

const log = createLogger('DATABASE');

export interface QueryResult {
  success: boolean;
  meta?: {
    duration: number;
    rows_read?: number;
    rows_written?: number;
  };
  error?: string;
}

export class DatabaseManager {
  public db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
    log.info('DatabaseManager initialized');
  }

  // ==========================================================================
  // Query Execution
  // ==========================================================================

  async execute(
    sql: string,
    params?: unknown[]
  ): Promise<D1Result> {
    try {
      log.debug('Executing SQL', { sql, params });
      const result = await this.db.prepare(sql).bind(...(params ?? [])).run();
      return result;
    } catch (error) {
      log.error('Database execute error', error as Error, { sql, params });
      throw error;
    }
  }

  async query<T>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    try {
      log.debug('Querying SQL', { sql, params });
      const result = await this.db.prepare(sql).bind(...(params ?? [])).all();
      return result.results as T[];
    } catch (error) {
      log.error('Database query error', error as Error, { sql, params });
      throw error;
    }
  }

  async queryFirst<T>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    try {
      log.debug('Querying first SQL', { sql, params });
      const result = await this.db.prepare(sql).bind(...(params ?? [])).first();
      return (result as T) ?? null;
    } catch (error) {
      log.error('Database queryFirst error', error as Error, { sql, params });
      throw error;
    }
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  async batch(statements: { sql: string; params?: unknown[] }[]): Promise<D1Result[]> {
    try {
      log.debug('Executing batch', { count: statements.length });
      const stmts = statements.map((s) =>
        this.db.prepare(s.sql).bind(...(s.params ?? []))
      );
      return await this.db.batch(stmts);
    } catch (error) {
      log.error('Database batch error', error as Error);
      throw error;
    }
  }

  // ==========================================================================
  // Transactions
  // ==========================================================================

  // D1 doesn't support multi-statement transactions directly,
  // but operations within a single request are atomic
  async transaction<T>(
    callback: (db: DatabaseManager) => Promise<T>
  ): Promise<T> {
    // For single-statement transactions, D1 is already atomic
    // For complex transactions, use batch()
    return callback(this);
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.queryFirst<{ result: number }>('SELECT 1 as result');
      return true;
    } catch (error) {
      log.warn('Database health check failed', { error: (error as Error).message });
      return false;
    }
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  // Valid table names to prevent SQL injection
  private readonly VALID_TABLES = new Set([
    'trades',
    'positions',
    'signals',
    'risk_state',
    'daily_metrics',
    'equity_curve',
    'audit_log',
  ] as const);

  private validateTable(table: string): void {
    if (!(this.VALID_TABLES as Set<string>).has(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
  }

  private validateOrderBy(orderBy: string): void {
    // Only allow alphanumeric and underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderBy)) {
      throw new Error(`Invalid orderBy column: ${orderBy}`);
    }
  }

  async insert<T extends Record<string, unknown>>(
    table: string,
    data: T
  ): Promise<void> {
    this.validateTable(table);

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');

    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
    `;

    await this.execute(sql, values);
  }

  async update<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    this.validateTable(table);

    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');

    const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = ?
    `;

    await this.execute(sql, [...values, id]);
  }

  async delete(table: string, id: string): Promise<void> {
    this.validateTable(table);

    const sql = `DELETE FROM ${table} WHERE id = ?`;
    await this.execute(sql, [id]);
  }

  async findById<T extends { id: string }>(
    table: string,
    id: string
  ): Promise<T | null> {
    this.validateTable(table);

    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    return await this.queryFirst<T>(sql, [id]);
  }

  async findAll<T>(table: string, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDir?: 'ASC' | 'DESC';
  }): Promise<T[]> {
    this.validateTable(table);

    let sql = `SELECT * FROM ${table}`;

    if (options?.orderBy) {
      this.validateOrderBy(options.orderBy);
      const orderDir = options.orderDir === 'DESC' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${options.orderBy} ${orderDir}`;
    }

    if (options?.limit !== undefined) {
      if (options.limit < 0) {
        throw new Error('Limit must be non-negative');
      }
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset !== undefined) {
      if (options.offset < 0) {
        throw new Error('Offset must be non-negative');
      }
      sql += ` OFFSET ${options.offset}`;
    }

    return await this.query<T>(sql);
  }
}

// ============================================================================
// Factory
// =============================================================================

export function createDatabaseManager(db: D1Database): DatabaseManager {
  return new DatabaseManager(db);
}
