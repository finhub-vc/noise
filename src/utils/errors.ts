/**
 * Custom Error Classes
 * Domain-specific errors for the NOISE trading engine
 */

// =============================================================================
// Base Error
// =============================================================================

export class TradingError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

// =============================================================================
// Broker Errors
// =============================================================================

export class BrokerError extends TradingError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BROKER_ERROR', context);
  }
}

export class BrokerConnectionError extends BrokerError {
  constructor(broker: string, context?: Record<string, unknown>) {
    super(`Failed to connect to broker: ${broker}`, { broker, ...context });
  }
}

export class BrokerAuthenticationError extends BrokerError {
  constructor(broker: string, context?: Record<string, unknown>) {
    super(`Authentication failed for broker: ${broker}`, { broker, ...context });
  }
}

export class OrderRejectedError extends BrokerError {
  constructor(symbol: string, reason: string, context?: Record<string, unknown>) {
    super(`Order rejected for ${symbol}: ${reason}`, { symbol, reason, ...context });
  }
}

export class OrderNotFoundError extends BrokerError {
  constructor(orderId: string, context?: Record<string, unknown>) {
    super(`Order not found: ${orderId}`, { orderId, ...context });
  }
}

// =============================================================================
// Risk Errors
// =============================================================================

export class RiskError extends TradingError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'RISK_ERROR', context);
  }
}

export class CircuitBreakerError extends RiskError {
  constructor(reason: string, until?: number, context?: Record<string, unknown>) {
    super(`Circuit breaker triggered: ${reason}`, {
      reason,
      until,
      ...context,
    });
  }
}

export class PositionLimitError extends RiskError {
  constructor(current: number, max: number, context?: Record<string, unknown>) {
    super(`Position limit exceeded: ${current}/${max}`, {
      current,
      max,
      ...context,
    });
  }
}

export class ExposureLimitError extends RiskError {
  constructor(group: string, current: number, max: number, context?: Record<string, unknown>) {
    super(`Exposure limit exceeded for ${group}: ${current}/${max}`, {
      group,
      current,
      max,
      ...context,
    });
  }
}

export class DailyLossLimitError extends RiskError {
  constructor(currentLoss: number, limit: number, context?: Record<string, unknown>) {
    super(`Daily loss limit exceeded: ${currentLoss}%/${limit}%`, {
      currentLoss,
      limit,
      ...context,
    });
  }
}

export class PdtLimitError extends RiskError {
  constructor(dayTradesUsed: number, dayTradesRemaining: number, context?: Record<string, unknown>) {
    super(`PDT limit reached: ${dayTradesUsed} used, ${dayTradesRemaining} remaining`, {
      dayTradesUsed,
      dayTradesRemaining,
      ...context,
    });
  }
}

// =============================================================================
// Signal Errors
// =============================================================================

export class SignalError extends TradingError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SIGNAL_ERROR', context);
  }
}

export class InsufficientDataError extends SignalError {
  constructor(symbol: string, required: number, actual: number, context?: Record<string, unknown>) {
    super(`Insufficient data for ${symbol}: need ${required} bars, have ${actual}`, {
      symbol,
      required,
      actual,
      ...context,
    });
  }
}

export class InvalidSignalError extends SignalError {
  constructor(signalId: string, reason: string, context?: Record<string, unknown>) {
    super(`Invalid signal ${signalId}: ${reason}`, { signalId, reason, ...context });
  }
}

// =============================================================================
// Database Errors
// =============================================================================

export class DatabaseError extends TradingError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', context);
  }
}

export class RecordNotFoundError extends DatabaseError {
  constructor(table: string, id: string, context?: Record<string, unknown>) {
    super(`Record not found in ${table}: ${id}`, { table, id, ...context });
  }
}

export class MigrationError extends DatabaseError {
  constructor(migration: string, reason: string, context?: Record<string, unknown>) {
    super(`Migration failed: ${migration} - ${reason}`, { migration, reason, ...context });
  }
}

// =============================================================================
// API Errors
// =============================================================================

export class ApiError extends TradingError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500, context?: Record<string, unknown>) {
    super(message, 'API_ERROR', context);
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(context?: Record<string, unknown>) {
    super('Unauthorized: Invalid or missing API key', 401, context);
  }
}

export class ForbiddenError extends ApiError {
  constructor(resource: string, context?: Record<string, unknown>) {
    super(`Forbidden: Access denied to ${resource}`, 403, { resource, ...context });
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id: string, context?: Record<string, unknown>) {
    super(`Not found: ${resource} ${id}`, 404, { resource, id, ...context });
  }
}

export class ValidationError extends ApiError {
  constructor(field: string, reason: string, context?: Record<string, unknown>) {
    super(`Validation failed: ${field} - ${reason}`, 400, { field, reason, ...context });
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function isTradingError(error: unknown): error is TradingError {
  return error instanceof TradingError;
}

export function getErrorCode(error: unknown): string {
  if (isTradingError(error)) return error.code;
  if (error instanceof Error) return error.name;
  return 'UNKNOWN_ERROR';
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
