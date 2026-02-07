/**
 * Validation Middleware
 * Zod-based request validation for query parameters and request bodies
 */

import { z } from 'zod';

interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  NOISE_API_KEY?: string;
  [key: string]: string | D1Database | undefined;
}

// =============================================================================
// Validation Error Response
// =============================================================================

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationErrorResponse {
  error: string;
  details: ValidationError[];
}

function createValidationErrorResponse(errors: z.ZodIssue[]): Response {
  const details: ValidationError[] = errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details,
    } satisfies ValidationErrorResponse),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// =============================================================================
// Common Schemas
// =============================================================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.number().int().optional(),
  endDate: z.coerce.number().int().optional(),
});

export const signalFilterSchema = paginationSchema.extend({
  symbol: z.string().optional(),
  strategy: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'EXECUTED', 'CANCELLED']).optional(),
}).merge(dateRangeSchema);

export const tradeFilterSchema = paginationSchema.extend({
  symbol: z.string().optional(),
  status: z.enum(['PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED']).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
}).merge(dateRangeSchema);

export const createSignalSchema = z.object({
  symbol: z.string().min(1),
  assetClass: z.enum(['FUTURES', 'EQUITY']),
  direction: z.enum(['LONG', 'SHORT']),
  strength: z.number().min(0).max(1),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive().optional(),
  timeframe: z.string().default('15m'),
  strategy: z.string().default('manual'),
  reasons: z.array(z.string()).default([]),
  expiresAt: z.number().int().optional(),
});

export const updateSignalSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'EXECUTED', 'CANCELLED']).optional(),
  strength: z.number().min(0).max(1).optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  reasons: z.array(z.string()).optional(),
});

export const createTradeSchema = z.object({
  symbol: z.string().min(1),
  assetClass: z.enum(['FUTURES', 'EQUITY']),
  broker: z.enum(['tradovate', 'alpaca']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  orderType: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  signalId: z.string().optional(),
});

export const updateTradeSchema = z.object({
  status: z.enum(['PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED']).optional(),
  filledQuantity: z.number().nonnegative().optional(),
  avgFillPrice: z.number().positive().optional(),
});

export const quoteRequestSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1).max(100),
});

export const performanceQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year', 'all']).default('all'),
});

// =============================================================================
// Validation Middleware Factory
// =============================================================================

type ValidationSchema = z.ZodSchema<any>;

export function createValidationMiddleware(schema: ValidationSchema, source: 'query' | 'body' = 'query') {
  return async (request: Request, _env: Env): Promise<Response | null> => {
    try {
      let data: unknown;

      if (source === 'query') {
        const url = new URL(request.url);
        data = Object.fromEntries(url.searchParams.entries());
      } else {
        // Parse body as JSON
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('application/json')) {
          return new Response(
            JSON.stringify({ error: 'Content-Type must be application/json' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        data = await request.json().catch(() => ({}));
      }

      const result = await schema.safeParseAsync(data);

      if (!result.success) {
        return createValidationErrorResponse(result.error.issues);
      }

      // Attach validated data to request for use in handlers
      (request as any).validated = result.data;

      return null; // No error, proceed to handler
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Validation error', message: (error as Error).message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

// =============================================================================
// Composable Middleware
// =============================================================================

export function withValidation(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response,
  schema: ValidationSchema,
  source: 'query' | 'body' = 'query'
) {
  const validate = createValidationMiddleware(schema, source);

  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    const validationError = await validate(request, env);
    if (validationError) return validationError;

    return handler(request, env, ctx);
  };
}

// =============================================================================
// Export all schemas
// =============================================================================

export const schemas = {
  pagination: paginationSchema,
  dateRange: dateRangeSchema,
  signalFilter: signalFilterSchema,
  tradeFilter: tradeFilterSchema,
  createSignal: createSignalSchema,
  updateSignal: updateSignalSchema,
  createTrade: createTradeSchema,
  updateTrade: updateTradeSchema,
  quoteRequest: quoteRequestSchema,
  performanceQuery: performanceQuerySchema,
};
