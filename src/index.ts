/**
 * NOISE Trading Engine - Main Worker Entry Point
 * Cloudflare Worker with API routes and scheduled tasks
 */

import { AutoRouter } from 'itty-router';
import { createLogger } from './utils/index.js';
import {
  corsPreflightResponse,
  withApiHeaders,
} from './middleware/cors.js';
import {
  createSignalSchema,
  updateSignalSchema,
  createTradeSchema,
  updateTradeSchema,
  quoteRequestSchema,
  createValidationMiddleware,
} from './middleware/validation.js';
import { isWebSocketUpgrade, upgradeWebSocket } from './websocket/upgradeWebSocket.js';

// Validation schemas are imported from middleware/validation.ts
// Re-exporting types for convenience
type CreateSignalRequest = {
  signal: {
    symbol: string;
    assetClass?: 'FUTURES' | 'EQUITY';
    direction: 'LONG' | 'SHORT';
    strength: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit?: number;
    timeframe?: string;
    strategy?: string;
    reasons?: string[];
    expiresAt?: number;
  };
};

type UpdateSignalRequest = {
  status?: 'ACTIVE' | 'EXPIRED' | 'EXECUTED' | 'CANCELLED';
  strength?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasons?: string[];
};

type QuotesRequest = {
  symbols: string[];
};

type CreateTradeRequest = {
  trade: {
    symbol: string;
    assetClass: 'FUTURES' | 'EQUITY';
    broker: 'tradovate' | 'alpaca';
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    limitPrice?: number;
    signalId?: string;
  };
};

type UpdateTradeRequest = {
  status?: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  filledQuantity?: number;
  avgFillPrice?: number;
};

const log = createLogger('MAIN');

// =============================================================================
// Environment
// =============================================================================

interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  TRADOVATE_LIVE?: string;
  NOISE_API_KEY?: string;
  // Broker credentials
  TRADOVATE_USERNAME?: string;
  TRADOVATE_PASSWORD?: string;
  TRADOVATE_APP_ID?: string;
  TRADOVATE_CID?: string;
  TRADOVATE_SECRET?: string;
  ALPACA_API_KEY?: string;
  ALPACA_API_SECRET?: string;
}

// Risk state row type
interface RiskStateRow {
  id: number;
  current_equity: number;
  daily_pnl: number;
  daily_pnl_percent: number;
  consecutive_losses: number;
  circuit_breaker_triggered: number;
  circuit_breaker_reason: string | null;
  circuit_breaker_until: number | null;
  last_updated: number;
}

// =============================================================================
// Router Setup
// =============================================================================

const router = AutoRouter({
  before: [
    (request: Request, env: Env) => {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return corsPreflightResponse(request, env.ENVIRONMENT);
      }
      return undefined; // Continue to next handler
    },
  ],
  catch: (error: unknown) => {
    log.error('Request handler error', error as Error);
    return Response.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  },
  finally: [
    (response: Response, request: Request, env: Env) => {
      // Add CORS headers to all responses
      if (response && typeof response !== 'string') {
        return withApiHeaders(response.clone(), request, env.ENVIRONMENT);
      }
      return response;
    },
  ],
});

// =============================================================================
// Middleware
// =============================================================================

async function authenticate(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return errorResponse('Missing authorization header', request, env, 401);
  }

  // Extract token using regex to handle "Bearer" prefix safely
  const bearerMatch = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!bearerMatch) {
    return errorResponse('Invalid authorization format', request, env, 401);
  }

  const token = bearerMatch[1];
  const expectedKey = env.NOISE_API_KEY;

  if (!expectedKey) {
    return errorResponse('Server not configured', request, env, 500);
  }

  // Use timing-safe comparison to prevent timing attacks
  if (token.length !== expectedKey.length) {
    return errorResponse('Invalid API key', request, env, 403);
  }

  // Constant-time comparison
  const tokenBuffer = new TextEncoder().encode(token);
  const expectedBuffer = new TextEncoder().encode(expectedKey);
  let result = 0;
  for (let i = 0; i < tokenBuffer.length; i++) {
    result |= tokenBuffer[i]! ^ expectedBuffer[i]!;
  }

  if (result !== 0) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a JSON response with CORS and security headers
 */
function jsonResponse(data: unknown, request: Request, env: Env, status: number = 200): Response {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  return withApiHeaders(response, request, env.ENVIRONMENT);
}

/**
 * Create an error response with CORS and security headers
 */
function errorResponse(error: string, request: Request, env: Env, status: number = 500): Response {
  const response = new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  return withApiHeaders(response, request, env.ENVIRONMENT);
}

// =============================================================================
// Health Check
// =============================================================================

router.get('/api/health', () => {
  return Response.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0',
  });
});

// =============================================================================
// API Routes - Status
// =============================================================================

router.get('/api/status', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    // Get risk state
    const riskState = await env.DB.prepare(
      'SELECT * FROM risk_state WHERE id = 1'
    ).first();

    // Get positions count
    const positionsResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM positions'
    ).first();

    return jsonResponse({
      status: 'ok',
      environment: env.ENVIRONMENT || 'unknown',
      circuitBreaker: {
        triggered: Boolean(riskState?.circuit_breaker_triggered),
        reason: riskState?.circuit_breaker_reason,
        until: riskState?.circuit_breaker_until,
      },
      positions: {
        count: (positionsResult as { count?: number })?.count ?? 0,
      },
      risk: {
        dailyPnl: riskState?.daily_pnl ?? 0,
        dailyPnlPercent: riskState?.daily_pnl_percent ?? 0,
        consecutiveLosses: riskState?.consecutive_losses ?? 0,
      },
      timestamp: Date.now(),
    }, request, env);
  } catch (error) {
    log.error('Status endpoint error', error as Error);
    return errorResponse('Internal server error', request, env, 500);
  }
});

// =============================================================================
// API Routes - Account
// =============================================================================

router.get('/api/account', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const riskState = await env.DB.prepare(
      'SELECT * FROM risk_state WHERE id = 1'
    ).first() as RiskStateRow | null;

    return Response.json({
      equity: riskState?.current_equity ?? 0,
      cash: riskState?.current_equity ?? 0, // Simplified
      buyingPower: (riskState?.current_equity ?? 0) * 2, // 2x leverage
      dailyPnl: riskState?.daily_pnl ?? 0,
      dailyPnlPercent: riskState?.daily_pnl_percent ?? 0,
      lastUpdated: riskState?.last_updated ?? 0,
    });
  } catch (error) {
    log.error('Account endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Positions
// =============================================================================

router.get('/api/positions', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const positions = await env.DB.prepare(
      'SELECT * FROM positions ORDER BY symbol'
    ).all();

    return Response.json({
      positions: positions.results || [],
      count: (positions.results || []).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Positions endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Trades
// =============================================================================

router.get('/api/trades/today', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const timestamp = startOfDay.getTime();

    const trades = await env.DB.prepare(
      'SELECT * FROM trades WHERE created_at >= ? ORDER BY created_at DESC'
    ).bind(timestamp).all();

    return Response.json({
      trades: trades.results || [],
      count: (trades.results || []).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Today trades endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Signals
// =============================================================================

router.get('/api/signals/active', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const now = Date.now();
    const signals = await env.DB.prepare(
      'SELECT * FROM signals WHERE status = "ACTIVE" AND expires_at > ? ORDER BY timestamp DESC'
    ).bind(now).all();

    return Response.json({
      signals: signals.results || [],
      count: (signals.results || []).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Active signals endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Risk
// =============================================================================

router.get('/api/risk/state', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const riskState = await env.DB.prepare(
      'SELECT * FROM risk_state WHERE id = 1'
    ).first();

    return Response.json(riskState);
  } catch (error) {
    log.error('Risk state endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

router.post('/api/risk/reset-circuit-breaker', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    await env.DB.prepare(
      'UPDATE risk_state SET circuit_breaker_triggered = 0, circuit_breaker_until = NULL, circuit_breaker_reason = NULL WHERE id = 1'
    ).run();

    log.info('Circuit breaker reset via API');

    return Response.json({
      success: true,
      message: 'Circuit breaker reset',
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Reset circuit breaker endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Audit
// =============================================================================

router.get('/api/audit', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const logs = await env.DB.prepare(
      'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();

    return Response.json({
      logs: logs.results || [],
      count: (logs.results || []).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Audit endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// CORS
// =============================================================================

// Use enhanced CORS middleware
router.options('*', (request: Request, env: Env) => corsPreflightResponse(request, env.ENVIRONMENT));

// =============================================================================
// API Routes - Signals (Additional Endpoints)
// =============================================================================

// List all signals with pagination and filters
router.get('/api/signals', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const symbol = url.searchParams.get('symbol');
    const strategy = url.searchParams.get('strategy');
    const status = url.searchParams.get('status');

    let query = 'SELECT * FROM signals WHERE 1=1';
    const params: (string | number)[] = [];

    if (symbol) {
      query += ' AND symbol = ?';
      params.push(symbol);
    }
    if (strategy) {
      query += ' AND strategy = ?';
      params.push(strategy);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = env.DB.prepare(query);
    for (let i = 0; i < params.length; i++) {
      stmt.bind(params[i]);
    }
    const signals = await stmt.all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM signals WHERE 1=1';
    const countParams: (string | number)[] = [];
    if (symbol) {
      countQuery += ' AND symbol = ?';
      countParams.push(symbol);
    }
    if (strategy) {
      countQuery += ' AND strategy = ?';
      countParams.push(strategy);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const countStmt = env.DB.prepare(countQuery);
    for (let i = 0; i < countParams.length; i++) {
      countStmt.bind(countParams[i]);
    }
    const countResult = await countStmt.first();

    return Response.json({
      signals: signals.results || [],
      total: (countResult as any)?.count ?? 0,
      limit,
      offset,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Signals endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Create a new signal (manual entry)
router.post('/api/signals', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  // Validate request body
  const validateSignal = createValidationMiddleware(
    createSignalSchema.extend({ signal: createSignalSchema }),
    'body'
  );
  const validationError = await validateSignal(request, env);
  if (validationError) return validationError;

  try {
    const body = await request.json() as CreateSignalRequest;
    const { signal } = body;

    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = signal.expiresAt ?? (now + 24 * 60 * 60 * 1000); // Default 24 hours

    await env.DB.prepare(
      `INSERT INTO signals (
        id, symbol, asset_class, timeframe, direction, strength,
        entry_price, stop_loss, take_profit, source, strategy,
        status, reasons, timestamp, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      signal.symbol,
      signal.assetClass || 'EQUITY',
      signal.timeframe || '15m',
      signal.direction,
      signal.strength,
      signal.entryPrice,
      signal.stopLoss,
      signal.takeProfit || null,
      'manual',
      signal.strategy || 'manual',
      'ACTIVE',
      JSON.stringify(signal.reasons || []),
      now,
      expiresAt
    ).run();

    // Fetch the created signal
    const createdSignal = await env.DB.prepare(
      'SELECT * FROM signals WHERE id = ?'
    ).bind(id).first();

    log.info('Signal created via API', { id, symbol: signal.symbol });

    return Response.json({
      signal: createdSignal,
      timestamp: Date.now(),
    }, { status: 201 });
  } catch (error) {
    log.error('Create signal endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Update signal status
router.put('/api/signals/:id', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  // Validate request body
  const validateUpdate = createValidationMiddleware(updateSignalSchema, 'body');
  const validationError = await validateUpdate(request, env as any);
  if (validationError) return validationError;

  try {
    const url = new URL(request.url);
    const signalId = url.pathname.split('/').pop();
    const body = await request.json() as UpdateSignalRequest;
    const updates = body;

    if (!signalId) {
      return Response.json({ error: 'Missing signal ID' }, { status: 400 });
    }

    // Build dynamic update query
    const setClauses: string[] = [];
    const params: (string | number)[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.strength !== undefined) {
      setClauses.push('strength = ?');
      params.push(updates.strength);
    }
    if (updates.stopLoss !== undefined) {
      setClauses.push('stop_loss = ?');
      params.push(updates.stopLoss);
    }
    if (updates.takeProfit !== undefined) {
      setClauses.push('take_profit = ?');
      params.push(updates.takeProfit);
    }
    if (updates.reasons !== undefined) {
      setClauses.push('reasons = ?');
      params.push(JSON.stringify(updates.reasons));
    }

    if (setClauses.length === 0) {
      return Response.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    params.push(signalId);

    await env.DB.prepare(
      `UPDATE signals SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    // Fetch updated signal
    const updatedSignal = await env.DB.prepare(
      'SELECT * FROM signals WHERE id = ?'
    ).bind(signalId).first();

    log.info('Signal updated via API', { id: signalId });

    return Response.json({
      signal: updatedSignal,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Update signal endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Delete/cancel signal
router.delete('/api/signals/:id', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const signalId = url.pathname.split('/').pop();

    if (!signalId) {
      return Response.json({ error: 'Missing signal ID' }, { status: 400 });
    }

    // Update status to CANCELLED instead of deleting
    await env.DB.prepare(
      'UPDATE signals SET status = ? WHERE id = ?'
    ).bind('CANCELLED', signalId).run();

    log.info('Signal cancelled via API', { id: signalId });

    return Response.json({
      success: true,
      message: 'Signal cancelled',
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Delete signal endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Trades (Additional Endpoints)
// =============================================================================

// List all trades with filters
router.get('/api/trades', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const symbol = url.searchParams.get('symbol');
    const status = url.searchParams.get('status');
    const side = url.searchParams.get('side');

    let query = 'SELECT * FROM trades WHERE 1=1';
    const params: (string | number)[] = [];

    if (symbol) {
      query += ' AND symbol = ?';
      params.push(symbol);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (side) {
      query += ' AND side = ?';
      params.push(side);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = env.DB.prepare(query);
    for (let i = 0; i < params.length; i++) {
      stmt.bind(params[i]);
    }
    const trades = await stmt.all();

    return Response.json({
      trades: trades.results || [],
      limit,
      offset,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Trades endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Manual trade entry
router.post('/api/trades', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  // Validate request body
  const validateTrade = createValidationMiddleware(
    createTradeSchema.extend({ trade: createTradeSchema }),
    'body'
  );
  const validationError = await validateTrade(request, env as any);
  if (validationError) return validationError;

  try {
    const body = await request.json() as CreateTradeRequest;
    const { trade } = body;

    const clientOrderId = `${trade.symbol}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO trades (
        id, symbol, asset_class, broker, client_order_id, side, quantity,
        order_type, limit_price, status, created_at, signal_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      trade.symbol,
      trade.assetClass,
      trade.broker,
      clientOrderId,
      trade.side,
      trade.quantity,
      trade.orderType,
      trade.limitPrice || null,
      'PENDING',
      now,
      trade.signalId || null
    ).run();

    log.info('Trade created via API', { id, symbol: trade.symbol, side: trade.side });

    return Response.json({
      trade: { id, clientOrderId, ...trade, status: 'PENDING', createdAt: now },
      timestamp: Date.now(),
    }, { status: 201 });
  } catch (error) {
    log.error('Create trade endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Update trade details
router.put('/api/trades/:id', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  // Validate request body
  const validateUpdate = createValidationMiddleware(updateTradeSchema, 'body');
  const validationError = await validateUpdate(request, env as any);
  if (validationError) return validationError;

  try {
    const url = new URL(request.url);
    const tradeId = url.pathname.split('/').pop();
    const body = await request.json() as UpdateTradeRequest;
    const updates = body;

    if (!tradeId) {
      return Response.json({ error: 'Missing trade ID' }, { status: 400 });
    }

    // Build dynamic update query
    const setClauses: string[] = [];
    const params: (string | number)[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.filledQuantity !== undefined) {
      setClauses.push('filled_quantity = ?');
      params.push(updates.filledQuantity);
    }
    if (updates.avgFillPrice !== undefined) {
      setClauses.push('avg_fill_price = ?');
      params.push(updates.avgFillPrice);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    params.push(tradeId);

    await env.DB.prepare(
      `UPDATE trades SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    // Fetch updated trade
    const updatedTrade = await env.DB.prepare(
      'SELECT * FROM trades WHERE id = ?'
    ).bind(tradeId).first();

    log.info('Trade updated via API', { id: tradeId });

    return Response.json({
      trade: updatedTrade,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Update trade endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Performance
// =============================================================================

router.get('/api/performance', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'all';

    let startTime = 0;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    switch (period) {
      case 'day':
        startTime = now - dayMs;
        break;
      case 'week':
        startTime = now - (7 * dayMs);
        break;
      case 'month':
        startTime = now - (30 * dayMs);
        break;
      case 'year':
        startTime = now - (365 * dayMs);
        break;
    }

    // Get metrics for the period
    const trades = await env.DB.prepare(
      `SELECT * FROM trades WHERE created_at >= ? AND status = 'FILLED'`
    ).bind(startTime).all();

    const tradeList = trades.results || [];
    const totalTrades = tradeList.length;
    let totalPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    for (const trade of tradeList as any[]) {
      const pnl = trade.pnl || 0;
      totalPnl += pnl;
      if (pnl > 0) {
        winningTrades++;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losingTrades++;
        grossLoss += Math.abs(pnl);
      }
    }

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Calculate Sharpe ratio (simplified - annualized)
    let sharpeRatio = 0;
    if (totalTrades > 1) {
      const avgPnl = totalPnl / totalTrades;
      const variance = tradeList.reduce((sum: number, t: any) => {
        return sum + Math.pow((t.pnl || 0) - avgPnl, 2);
      }, 0) / totalTrades;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (avgPnl / stdDev) * Math.sqrt(252) : 0;
    }

    // Get equity curve data points
    const equityPoints = await env.DB.prepare(
      `SELECT * FROM equity_curve WHERE timestamp >= ? ORDER BY timestamp`
    ).bind(startTime).all();

    return Response.json({
      period,
      summary: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: Math.round(winRate * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossLoss: Math.round(grossLoss * 100) / 100,
        profitFactor: profitFactor === Infinity ? '∞' : Math.round(profitFactor * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      },
      equityCurve: equityPoints.results || [],
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Performance endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

router.get('/api/performance/equity-curve', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 10000);

    const equityPoints = await env.DB.prepare(
      'SELECT * FROM equity_curve ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();

    return Response.json({
      equityCurve: (equityPoints.results || []).reverse(),
      count: (equityPoints.results || []).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Equity curve endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Quotes
// =============================================================================

router.post('/api/quotes', async (request: Request, env: Env) => {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  // Validate request body
  const validateQuotes = createValidationMiddleware(quoteRequestSchema, 'body');
  const validationError = await validateQuotes(request, env as any);
  if (validationError) return validationError;

  try {
    const body = await request.json() as QuotesRequest;
    const { symbols } = body;

    // For now, return mock quotes
    // In production, this would fetch from the brokers
    const quotes = symbols.map((symbol: string) => ({
      symbol,
      bid: null,
      ask: null,
      last: null,
      change: null,
      changePercent: null,
      volume: null,
      timestamp: Date.now(),
    }));

    return Response.json({
      quotes,
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Quotes endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// Scheduled Task - Signal Processing
// =============================================================================

export async function scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
  log.info('Scheduled task triggered');

  try {
    // This is where signal processing would happen
    // For now, just log that it ran
    log.info('Signal processing completed');
  } catch (error) {
    log.error('Scheduled task error', error as Error);
  }
}

// =============================================================================
// Main Fetch Handler
// =============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    // Handle WebSocket upgrade requests
    if (isWebSocketUpgrade(request)) {
      return upgradeWebSocket(request, { NOISE_D1_DATABASE: env.DB }, ctx);
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    // Handle regular HTTP requests through the router
    return router.fetch(request, env, ctx).then(withApiHeaders);
  },

  scheduled,
};
