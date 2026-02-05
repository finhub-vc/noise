/**
 * NOISE Trading Engine - Main Worker Entry Point
 * Cloudflare Worker with API routes and scheduled tasks
 */

import { Router } from 'itty-router';
import type { RiskConfig } from './types/index.js';
import { DEFAULT_RISK_CONFIG } from './config/index.js';
import { createLogger } from './utils/index.js';

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

// =============================================================================
// Router Setup
// =============================================================================

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

function authenticate(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');

  if (token !== env.NOISE_API_KEY) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
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
  const authError = authenticate(request, env);
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

    return Response.json({
      status: 'ok',
      environment: env.ENVIRONMENT || 'unknown',
      circuitBreaker: {
        triggered: Boolean(riskState?.circuit_breaker_triggered),
        reason: riskState?.circuit_breaker_reason,
        until: riskState?.circuit_breaker_until,
      },
      positions: {
        count: (positionsResult as any)?.count || 0,
      },
      risk: {
        dailyPnl: riskState?.daily_pnl || 0,
        dailyPnlPercent: riskState?.daily_pnl_percent || 0,
        consecutiveLosses: riskState?.consecutive_losses || 0,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('Status endpoint error', error as Error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// =============================================================================
// API Routes - Account
// =============================================================================

router.get('/api/account', async (request: Request, env: Env) => {
  const authError = authenticate(request, env);
  if (authError) return authError;

  try {
    const riskState = await env.DB.prepare(
      'SELECT * FROM risk_state WHERE id = 1'
    ).first() as any;

    return Response.json({
      equity: riskState?.current_equity || 0,
      cash: riskState?.current_equity || 0, // Simplified
      buyingPower: (riskState?.current_equity || 0) * 2, // 2x leverage
      dailyPnl: riskState?.daily_pnl || 0,
      dailyPnlPercent: riskState?.daily_pnl_percent || 0,
      lastUpdated: riskState?.last_updated || 0,
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
  const authError = authenticate(request, env);
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
  const authError = authenticate(request, env);
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
  const authError = authenticate(request, env);
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
  const authError = authenticate(request, env);
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
  const authError = authenticate(request, env);
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
  const authError = authenticate(request, env);
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

router.options('*', () => cors());

// =============================================================================
// Scheduled Task - Signal Processing
// =============================================================================

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  log.info('Scheduled task triggered', { cron: event.cron });

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
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return cors();
    }

    return router.handle(request, env).catch((error) => {
      log.error('Request handler error', error);
      return Response.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    });
  },

  scheduled,
};
