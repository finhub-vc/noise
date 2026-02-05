/**
 * Audit Log Repository
 * Data access layer for audit logging
 */

import type { AuditLog, CreateAuditLogInput, AuditSeverity, AuditCategory } from '@/types/database.js';
import { generateId, createLogger } from '@/utils/index.js';
import type { DatabaseManager } from '../DatabaseManager.js';

const log = createLogger('AUDIT_REPO');

export class AuditLogRepository {
  constructor(private db: DatabaseManager) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    const auditLog: AuditLog = {
      id: generateId('audit'),
      timestamp: Date.now(),
      severity: input.severity,
      category: input.category,
      message: input.message,
      context: input.context ? JSON.stringify(input.context) : null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
    };

    await this.db.insert('audit_log', auditLog);
  }

  async query(options?: {
    severity?: AuditSeverity;
    category?: AuditCategory;
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: unknown[] = [];

    if (options?.severity) {
      sql += ' AND severity = ?';
      params.push(options.severity);
    }

    if (options?.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

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

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const result = await this.db.db.prepare(sql).bind(...params).all();
    return result.results as AuditLog[];
  }

  async getRecent(limit: number = 100): Promise<AuditLog[]> {
    const sql = 'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?';
    const result = await this.db.db.prepare(sql).bind(limit).all();
    return result.results as AuditLog[];
  }

  async getErrors(limit: number = 50): Promise<AuditLog[]> {
    const sql = `
      SELECT * FROM audit_log
      WHERE severity IN ('ERROR', 'CRITICAL')
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    const result = await this.db.db.prepare(sql).bind(limit).all();
    return result.results as AuditLog[];
  }

  async getByEntity(entityId: string, entityType: string): Promise<AuditLog[]> {
    const sql = `
      SELECT * FROM audit_log
      WHERE related_entity_id = ? AND related_entity_type = ?
      ORDER BY timestamp DESC
    `;
    const result = await this.db.db.prepare(sql).bind(entityId, entityType).all();
    return result.results as AuditLog[];
  }

  async prune(olderThanDays: number = 30): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const sql = 'DELETE FROM audit_log WHERE timestamp < ?';
    const result = await this.db.execute(sql, [cutoff]);
    const count = result.meta?.changes ?? 0;
    if (count > 0) {
      log.info('Audit logs pruned', { count, cutoff });
    }
    return count;
  }

  // Convenience methods for common log types
  async logOrder(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ severity: 'INFO', category: 'ORDER', message, context });
  }

  async logRisk(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ severity: 'INFO', category: 'RISK', message, context });
  }

  async logRiskWarning(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ severity: 'WARN', category: 'RISK', message, context });
  }

  async logRiskError(message: string, error?: Error, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      severity: 'ERROR',
      category: 'RISK',
      message,
      context: { ...context, error: error?.message },
    });
  }

  async logSignal(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ severity: 'INFO', category: 'SIGNAL', message, context });
  }

  async logBroker(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ severity: 'INFO', category: 'BROKER', message, context });
  }

  async logSystem(message: string, severity: AuditSeverity = 'INFO', context?: Record<string, unknown>): Promise<void> {
    await this.log({ severity, category: 'SYSTEM', message, context });
  }
}
