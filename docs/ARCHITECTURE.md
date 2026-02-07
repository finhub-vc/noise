# NOISE System Architecture

**Version:** 1.0.0
**Date:** February 6, 2026
**Status:** Implementation Phase - Core Features Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [System Components](#system-components)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Directory Structure](#directory-structure)
7. [Component Design](#component-design)
8. [Integration Patterns](#integration-patterns)
9. [Security Architecture](#security-architecture)
10. [Error Handling Strategy](#error-handling-strategy)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Architecture](#deployment-architecture)

---

## Overview

NOISE (Networked Optimization for Intelligent Signal Execution) is a serverless algorithmic trading engine built on Cloudflare's edge computing platform. The system processes market data, generates trading signals, manages risk, and executes orders through dual-broker architecture (Tradovate for futures, Alpaca for equities).

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Dashboard  │    │  API Worker  │    │  Scheduler   │          │
│  │   (Pages)    │◄──►│   (Worker)   │◄───│   (Cron)     │          │
│  │              │    │              │    │  Every 1m    │          │
│  └──────────────┘    └──────┬───────┘    └──────────────┘          │
│                              │                                          │
│                              ▼                                          │
│      ┌─────────────────────────────────────────────┐                  │
│      │              Core Services Layer            │                  │
│      ├──────────┬──────────┬──────────┬────────────┤                  │
│      │  Signal  │   Risk   │  Broker  │   Database │                  │
│      │  Manager │  Manager │  Manager │    Manager │                  │
│      └──────────┴──────────┴──────────┴────────────┘                  │
│                              │                                          │
│      ┌─────────────────────────────────────────────┐                  │
│      │           Abstraction Layer                  │                  │
│      ├──────────┬──────────┬──────────┬────────────┤                  │
│      │ Indicators│Strategies│Repositories│ Adapters│                  │
│      └──────────┴──────────┴──────────┴────────────┘                  │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Cloudflare   │    │   Tradovate   │    │    Alpaca     │
│       D1      │    │    (Futures)  │    │  (Equities)   │
│   (Database)  │    │     REST      │    │     REST      │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## Architecture Principles

### 1. Serverless-First
- All compute runs on Cloudflare Workers (edge)
- No server management or provisioning
- Automatic scaling with zero cold starts (paid tier)

### 2. Unified Abstraction
- Single interface for both brokers
- Asset-class-based routing
- Type-safe data flow

### 3. Risk as a First-Class Citizen
- All orders pass through risk checks
- Circuit breakers prevent catastrophic losses
- Risk state persisted across executions

### 4. Signal-Driven Trading
- Multiple strategies with weighted signals
- Multi-timeframe confirmation
- Market regime adaptation

### 5. Immutable Audit Trail
- All events logged to audit table
- Trade history immutable
- Complete decision provenance

---

## System Components

### 1. API Worker (Cloudflare Worker)
**Purpose:** HTTP API endpoints for dashboard and external integrations

**Responsibilities:**
- Route incoming HTTP requests
- Authenticate requests (Bearer token)
- Return system status, positions, trades, signals, metrics
- Handle manual operations (circuit breaker reset, position sync)

**Endpoints:**
- `GET /api/status` - System health and status
- `GET /api/account` - Account information
- `GET /api/positions` - Open positions
- `GET /api/trades` - Trade history
- `GET /api/signals` - Signal history
- `GET /api/metrics/*` - Performance metrics
- `GET /api/risk/state` - Risk state
- `POST /api/risk/reset-circuit-breaker` - Reset breaker
- `GET /api/audit` - Audit logs

### 2. Scheduler Worker (Cloudflare Cron Trigger)
**Purpose:** Execute signal processing every minute

**Responsibilities:**
- Fetch latest market data for all watched symbols
- Calculate all technical indicators
- Run all trading strategies
- Generate signals
- Check risk parameters
- Place orders if signals meet criteria
- Update risk state
- Log all events

**Schedule:** `* * * * *` (every minute)

**Additional Scheduled Tasks:**
- Equity snapshot: Every hour (`0 * * * *`)
- End-of-day: 5 PM ET weekdays (`0 21 * * 1-5`)
- Daily reset: 9 AM ET weekdays (`0 13 * * 1-5`)
- Weekly reset: 6 AM ET Monday (`0 10 * * 1`)

### 3. Signal Manager
**Purpose:** Generate trading signals from market data

**Responsibilities:**
- Calculate technical indicators (RSI, MACD, BB, ATR, ADX, Volume)
- Run trading strategies (Momentum, Mean Reversion, Breakout)
- Detect market regime (Trend, Ranging, Volatility)
- Apply time-of-day filters
- Perform multi-timeframe confirmation
- Combine signals with weighted scoring
- Persist valid signals to database

**Input:** Market data (price, volume) from brokers
**Output:** Signal objects with direction, strength, entry price, stops

### 4. Risk Manager
**Purpose:** Evaluate all trading decisions against risk parameters

**Responsibilities:**
- Calculate position size (Kelly, volatility-adjusted)
- Check exposure limits (correlation groups, total exposure)
- Validate against circuit breakers (daily loss, weekly loss, drawdown)
- Enforce PDT limits for equities
- Track consecutive losses with cooldown
- Return ALLOW/BLOCK/REDUCE decision
- Log all risk decisions to audit

**Input:** Signal + Account State + Risk Config
**Output:** Risk Decision + Position Size

### 5. Broker Manager
**Purpose:** Unified interface for dual-broker architecture

**Responsibilities:**
- Route orders to correct broker based on asset class
- Aggregate account data from both brokers
- Combine positions from both brokers
- Handle broker-specific authentication
- Normalize broker responses to unified types
- Fallback and error handling

**Brokers:**
- **Tradovate** (Futures): MNQ, MES, M2K, MCL, MGC
- **Alpaca** (Equities): TQQQ, SOXL, SPY, etc.

### 6. Database Manager
**Purpose:** Persist all data to Cloudflare D1

**Responsibilities:**
- Execute SQL queries against D1
- Manage prepared statements
- Handle transactions
- Error handling and retry logic
- Query logging

**Tables:**
- `trades` - All orders
- `positions` - Open positions
- `trade_history` - Closed trades
- `signals` - Generated signals
- `risk_state` - Current risk state (singleton)
- `daily_metrics` - Daily performance
- `equity_curve` - Equity snapshots
- `audit_log` - Event logging

### 7. Dashboard (React on Cloudflare Pages)
**Purpose:** Real-time monitoring and control interface

**Responsibilities:**
- Display account summary (equity, cash, P&L)
- Show open positions with unrealized P&L
- Visualize exposure breakdown
- Display risk metrics and circuit breaker status
- Show equity curve and performance charts
- List trade and signal history
- Provide controls (circuit breaker reset, trading mode)

---

## Data Flow

### Signal Generation Flow

```
┌────────────────┐
│ Cron Trigger   │
│ (Every 1 min)  │
└───────┬────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 1. Fetch Market Data                    │
│    - Query Tradovate for futures prices │
│    - Query Alpaca for equities prices   │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 2. Calculate Indicators                 │
│    - RSI, MACD, Bollinger Bands         │
│    - ATR, ADX, Volume                   │
│    - For multiple timeframes            │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 3. Detect Market Regime                 │
│    - Trend strength (ADX)               │
│    - Volatility level (ATR percentile)  │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 4. Run Trading Strategies               │
│    - Momentum (40% weight)              │
│    - Mean Reversion (30% weight)        │
│    - Breakout (30% weight)              │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 5. Apply Filters                        │
│    - Multi-timeframe confirmation       │
│    - Time-of-day filter                 │
│    - Regime filter                      │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 6. Generate Signals                     │
│    - Direction (LONG/SHORT)             │
│    - Strength (0-1)                     │
│    - Entry price, stop loss, take profit│
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 7. Persist Signals                      │
│    - Save to signals table              │
└─────────────────────────────────────────┘
```

### Order Execution Flow

```
┌─────────────────────────────────────────┐
│ Signal Generated                        │
│ (from Signal Manager)                   │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ Risk Evaluation                         │
│ 1. Check circuit breakers               │
│ 2. Calculate position size              │
│ 3. Check exposure limits                │
│ 4. Validate PDT limits                  │
└───────┬─────────────────────────────────┘
        │
        ▼
     ┌──┴──┐
     │Pass?│
     └──┬──┘
        │ No
        ├─────────────────────────┐
        │                         │
        ▼ Yes                     ▼
┌───────────────┐         ┌──────────────┐
│ Broker Routing│         │ Log & Block  │
│ - Futures →   │         └──────────────┘
│   Tradovate   │
│ - Equities →  │
│   Alpaca      │
└───────┬───────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ Order Placement                         │
│ 1. Generate client order ID             │
│ 2. Place order via broker adapter       │
│ 3. Store trade in trades table          │
└───────┬─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ Order Monitoring                        │
│ 1. Poll order status                    │
│ 2. Update trade when filled             │
│ 3. Update positions table               │
│ 4. Update risk state                    │
└─────────────────────────────────────────┘
```

---

## Technology Stack

### Core Platform
| Technology | Purpose | Version |
|------------|---------|---------|
| Cloudflare Workers | Serverless compute | Latest |
| Cloudflare D1 | Serverless SQLite database | Latest |
| Cloudflare Cron Triggers | Scheduled tasks | Latest |
| Cloudflare Pages | Static frontend hosting | Latest |
| TypeScript | Type-safe development | 5.x |

### Backend Dependencies
| Package | Purpose |
|---------|---------|
| @cloudflare/workers-types | Cloudflare Workers TypeScript types |
| itty-router | Lightweight HTTP router |
| zod | Runtime type validation |

### Frontend Dependencies
| Package | Purpose |
|---------|---------|
| React | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| Recharts | Charting library |
| Tailwind CSS | Styling |
| axios | HTTP client |

### Development
| Package | Purpose |
|---------|---------|
| Vitest | Testing framework |
| wrangler | Cloudflare deployment CLI |
| TypeScript | Compiler |

---

## Directory Structure

```
noise/
├── docs/
│   ├── PRD.md
│   ├── EPICS.md
│   ├── ARCHITECTURE.md
│   └── INFRASTRUCTURE.md
├── src/
│   ├── index.ts                    # Main worker entry point
│   ├── types/
│   │   ├── broker.ts               # Unified broker types
│   │   ├── signal.ts               # Signal types
│   │   ├── risk.ts                 # Risk types
│   │   └── database.ts             # Database types
│   ├── brokers/
│   │   ├── interfaces.ts           # BrokerAdapter interface
│   │   ├── BrokerManager.ts        # Broker routing
│   │   ├── tradovate/
│   │   │   ├── TradovateAdapter.ts
│   │   │   ├── auth.ts
│   │   │   └── types.ts
│   │   └── alpaca/
│   │       ├── AlpacaAdapter.ts
│   │       ├── auth.ts
│   │       └── types.ts
│   ├── signals/
│   │   ├── SignalManager.ts        # Main orchestrator
│   │   ├── indicators/
│   │   │   ├── index.ts
│   │   │   ├── RSI.ts
│   │   │   ├── MACD.ts
│   │   │   ├── BollingerBands.ts
│   │   │   ├── ATR.ts
│   │   │   ├── ADX.ts
│   │   │   └── Volume.ts
│   │   ├── strategies/
│   │   │   ├── Momentum.ts
│   │   │   ├── MeanReversion.ts
│   │   │   └── Breakout.ts
│   │   ├── RegimeDetector.ts
│   │   └── TimeFilter.ts
│   ├── risk/
│   │   ├── RiskManager.ts          # Main orchestrator
│   │   ├── PositionSizer.ts
│   │   ├── ExposureManager.ts
│   │   ├── CircuitBreaker.ts
│   │   ├── PDTTracker.ts
│   │   └── config.ts
│   ├── db/
│   │   ├── DatabaseManager.ts
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql
│   │   │   ├── 002_trades.sql
│   │   │   └── ...
│   │   └── repositories/
│   │       ├── TradesRepository.ts
│   │       ├── PositionsRepository.ts
│   │       ├── SignalsRepository.ts
│   │       ├── RiskStateRepository.ts
│   │       ├── MetricsRepository.ts
│   │       └── AuditLogRepository.ts
│   ├── api/
│   │   ├── routes/
│   │   │   ├── status.ts
│   │   │   ├── account.ts
│   │   │   ├── positions.ts
│   │   │   ├── trades.ts
│   │   │   ├── signals.ts
│   │   │   ├── metrics.ts
│   │   │   ├── risk.ts
│   │   │   └── audit.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── cors.ts
│   │   └── router.ts
│   ├── config/
│   │   ├── risk.ts                 # Risk config defaults
│   │   ├── signal.ts               # Signal config defaults
│   │   └── contracts.ts            # Futures contract specs
│   └── utils/
│       ├── logger.ts
│       ├── errors.ts
│       └── helpers.ts
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── unit/
│   │   ├── indicators/
│   │   ├── strategies/
│   │   └── risk/
│   └── integration/
│       ├── signal-flow.test.ts
│       └── risk-flow.test.ts
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── migrate.sh
├── wrangler.toml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Component Design

### Broker Adapter Interface

All broker adapters must implement the `BrokerAdapter` interface:

```typescript
interface BrokerAdapter {
  // Authentication
  authenticate(): Promise<void>;
  refreshToken(): Promise<void>;

  // Account
  getAccount(): Promise<AccountInfo>;
  getPositions(): Promise<Position[]>;

  // Orders
  placeOrder(order: UnifiedOrder): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;

  // Broker metadata
  getBrokerType(): BrokerType;
  getAssetClass(): AssetClass;
}
```

### Signal Manager Design

```typescript
class SignalManager {
  constructor(
    private indicators: IndicatorRegistry,
    private strategies: StrategyRegistry,
    private regimeDetector: RegimeDetector,
    private timeFilter: TimeFilter,
    private signalsRepo: SignalsRepository
  ) {}

  async generateSignals(symbols: string[]): Promise<Signal[]> {
    // 1. Fetch market data for all symbols
    // 2. Calculate all indicators
    // 3. Detect market regime
    // 4. Run all strategies
    // 5. Apply filters
    // 6. Return valid signals
  }

  private calculateIndicators(symbol: string): Promise<IndicatorResults>;
  private runStrategies(indicators: IndicatorResults): Promise<StrategySignal[]>;
  private applyFilters(signals: StrategySignal[]): Promise<Signal[]>;
}
```

### Risk Manager Design

```typescript
class RiskManager {
  constructor(
    private config: RiskConfig,
    private positionSizer: PositionSizer,
    private exposureManager: ExposureManager,
    private circuitBreaker: CircuitBreaker,
    private pdtTracker: PDTTracker,
    private riskStateRepo: RiskStateRepository,
    private auditLog: AuditLogRepository
  ) {}

  async evaluateOrder(signal: Signal, account: AggregatedAccount): Promise<RiskDecision> {
    // 1. Check circuit breakers
    // 2. Check position limits
    // 3. Calculate position size
    // 4. Check exposure limits
    // 5. Check PDT limits (if equity)
    // 6. Return decision
  }

  async updateRiskState(trade: Trade): Promise<void>;
  async checkCircuitBreakers(): Promise<CircuitBreakerStatus>;
}
```

---

## Integration Patterns

### 1. Broker Integration Pattern

**Pattern:** Adapter Pattern with unified abstraction

**Rationale:** Each broker has different API, authentication, and data formats. The adapter pattern provides a unified interface while encapsulating broker-specific logic.

```typescript
// Unified interface
interface BrokerAdapter {
  placeOrder(order: UnifiedOrder): Promise<OrderResult>;
}

// Broker-specific implementations
class TradovateAdapter implements BrokerAdapter { }
class AlpacaAdapter implements BrokerAdapter { }

// Routing by asset class
class BrokerManager {
  private adapters: Map<AssetClass, BrokerAdapter>;

  placeOrder(order: UnifiedOrder): Promise<OrderResult> {
    const adapter = this.adapters.get(order.assetClass);
    return adapter.placeOrder(order);
  }
}
```

### 2. Signal Generation Pattern

**Pattern:** Strategy Pattern with composite scoring

**Rationale:** Multiple strategies need to be evaluated independently, then combined with weighted scoring to generate final signals.

```typescript
// Strategy interface
interface TradingStrategy {
  evaluate(indicators: IndicatorResults): StrategySignal | null;
}

// Concrete strategies
class MomentumStrategy implements TradingStrategy { }
class MeanReversionStrategy implements TradingStrategy { }

// Composite evaluation
class SignalManager {
  private strategies: Map<string, { strategy: TradingStrategy; weight: number }>;

  async generateSignals(indicators: IndicatorResults): Promise<Signal> {
    const signals = this.strategies.map(({ strategy, weight }) => ({
      signal: strategy.evaluate(indicators),
      weight
    }));

    return this.combineSignals(signals);
  }
}
```

### 3. Risk Check Pattern

**Pattern:** Chain of Responsibility

**Rationale:** Multiple risk checks must pass in sequence. If any check fails, the order is blocked.

```typescript
interface RiskCheck {
  check(context: RiskContext): Promise<RiskCheckResult>;
}

class CircuitBreakerCheck implements RiskCheck { }
class PositionSizeCheck implements RiskCheck { }
class ExposureCheck implements RiskCheck { }
class PDTCheck implements RiskCheck { }

class RiskManager {
  private checks: RiskCheck[];

  async evaluateOrder(signal: Signal): Promise<RiskDecision> {
    for (const check of this.checks) {
      const result = await check.check(context);
      if (!result.passed) {
        return { decision: 'BLOCK', reason: result.reason };
      }
    }
    return { decision: 'ALLOW', size: result.size };
  }
}
```

### 4. Repository Pattern

**Pattern:** Repository Pattern with D1

**Rationale:** Encapsulate data access logic and provide type-safe database operations.

```typescript
class TradesRepository {
  constructor(private db: DatabaseManager) { }

  async create(trade: Trade): Promise<void> {
    await this.db.execute(
      'INSERT INTO trades (...) VALUES (...)',
      [trade.id, trade.symbol, ...]
    );
  }

  async getById(id: string): Promise<Trade | null> {
    const result = await this.db.execute(
      'SELECT * FROM trades WHERE id = ?',
      [id]
    );
    return result.rows[0] ? this.mapToTrade(result.rows[0]) : null;
  }
}
```

---

## Security Architecture

### 1. Authentication

**API Authentication:**
- Bearer token in `Authorization` header
- Token stored in Cloudflare Secrets
- Token validated on every request

**Broker Authentication:**
- Tradovate: OAuth 2.0 with refresh tokens
- Alpaca: API key in headers
- Credentials stored in Cloudflare Secrets

### 2. Secrets Management

All sensitive data stored in Cloudflare Secrets:
```bash
# Via wrangler CLI
wrangler secret put TRADOVATE_USERNAME
wrangler secret put TRADOVATE_PASSWORD
wrangler secret put TRADOVATE_APP_ID
wrangler secret put TRADOVATE_SECRET
wrangler secret put ALPACA_API_KEY
wrangler secret put ALPACA_API_SECRET
wrangler secret put API_KEY
```

### 3. Data Encryption

- Data in transit: TLS 1.3 for all external connections
- Data at rest: Cloudflare D1 encryption (automatic)

### 4. Access Control

- Dashboard: Protected by API token
- API: Bearer token required for all endpoints
- Broker accounts: API-scoped permissions only (no withdrawal)

### 5. Audit Logging

All critical events logged to `audit_log` table:
- Order placement
- Risk decisions
- Circuit breaker triggers
- Authentication failures
- Configuration changes

---

## Error Handling Strategy

### 1. Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Validation | Invalid order params | 400 Bad Request, log error |
| Authentication | Invalid API token | 401 Unauthorized, log attempt |
| Authorization | Insufficient permissions | 403 Forbidden, log attempt |
| Not Found | Trade ID doesn't exist | 404 Not Found |
| Rate Limit | Broker API limit | 429, exponential backoff |
| Broker Error | Order rejected | 502, log to audit, notify |
| System Error | Database failure | 500, log error, alert |

### 2. Retry Logic

**Retryable Errors:**
- Network timeouts
- 5xx broker errors
- Rate limit errors

**Retry Strategy:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max retries: 3
- Jitter: ±25%

### 3. Circuit Breaking

**Broker Circuit Breaker:**
- Opens after 5 consecutive failures
- Half-open after 60 seconds
- Closes after 1 successful request

### 4. Error Logging

All errors logged with context:
```typescript
interface ErrorLog {
  timestamp: number;
  severity: 'ERROR' | 'WARN';
  category: string;
  message: string;
  stack?: string;
  context: Record<string, any>;
}
```

---

## Testing Strategy

### 1. Unit Tests

**Coverage Target:** >80%

**Components to Test:**
- All indicator calculations (RSI, MACD, BB, ATR, ADX)
- Position sizing calculations
- Exposure calculations
- PDT calculations
- Risk checks
- Strategy signal generation

**Example:**
```typescript
describe('RSI Indicator', () => {
  it('calculates RSI correctly for known values', () => {
    const prices = [/* known test data */];
    const rsi = calculateRSI(prices, 14);
    expect(rsi).toBeCloseTo(70.42, 2);
  });
});
```

### 2. Integration Tests

**Test Scenarios:**
- Signal generation end-to-end
- Risk check end-to-end
- Order placement (paper trading)
- Database CRUD operations
- API endpoints

**Example:**
```typescript
describe('Signal Generation Flow', () => {
  it('generates valid signals from market data', async () => {
    const signals = await signalManager.generateSignals(['MNQ']);
    expect(signals).toHaveLength(1);
    expect(signals[0].strength).toBeGreaterThan(0.6);
  });
});
```

### 3. Mock Strategy

**External Dependencies to Mock:**
- Broker APIs (Tradovate, Alpaca)
- Database (D1)
- Cron triggers

**Use Miniflare for local testing:**
```typescript
import { env } from 'cloudflare:test';

it('places order via Tradovate adapter', async () => {
  const adapter = new TradovateAdapter(env);
  const result = await adapter.placeOrder(testOrder);
  expect(result.status).toBe('FILLED');
});
```

---

## Deployment Architecture

### Environments

| Environment | Purpose | Database | Trading Mode |
|-------------|---------|----------|--------------|
| Development | Local development | Local D1 (miniflare) | Paper |
| Staging | Pre-production testing | noise-trading-dev | Paper |
| Production | Live trading | noise-trading-prod | Live |

### Deployment Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Local   │───►│   Dev    │───►│  Staging │───►│   Prod   │
│ Develop  │    │  Deploy  │    │  Test    │    │  Deploy  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                │                │
                     ▼                ▼                ▼
                Paper Trading    Paper Trading    Live Trading
```

### Deployment Process

**Automated Deployment (GitHub Actions):**
```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Cloudflare Workers
        run: wrangler deploy --env production
```

**Manual Deployment:**
```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### Database Migrations

**Migration Process:**
```bash
# Run migrations on development
npm run db:migrate

# Run migrations on production
npm run db:migrate:prod
```

**Migration Tracking:**
- Migrations run in version order
- Each migration recorded in `migrations` table
- Idempotent migration scripts

### Rollback Strategy

**Worker Rollback:**
```bash
# Deploy previous version
wrangler rollback --env production
```

**Database Rollback:**
- Manual rollback script required
- Data migrations must be reversible
- Always test rollback in staging first

---

## Monitoring and Observability

### 1. Health Checks

**Endpoint:** `GET /api/status`

**Returns:**
```json
{
  "status": "healthy",
  "brokers": {
    "tradovate": "connected",
    "alpaca": "connected"
  },
  "database": "connected",
  "circuitBreaker": "off",
  "lastSignalTime": "2026-02-05T10:30:00Z"
}
```

### 2. Performance Metrics

**Tracked Metrics:**
- API response times
- Signal generation latency
- Order placement latency
- Database query times
- Error rates

### 3. Business Metrics

**Tracked Metrics:**
- Win rate
- Profit factor
- Sharpe ratio
- Maximum drawdown
- Average trade duration
- Signal accuracy

### 4. Alerts

**Alert Conditions:**
- Circuit breaker triggered
- Broker disconnected
- Database query failed
- Signal generation failed
- Risk limit exceeded (warning level)

---

## Scalability Considerations

### Cloudflare Workers Limits

| Resource | Limit | Consideration |
|----------|-------|---------------|
| CPU time | 30ms (free) / 50ms (paid) | Keep signal processing efficient |
| Memory | 128MB | Monitor memory usage |
| Requests | 100k/day (free) | Paid tier for unlimited |
| D1 reads | 5M/day (free) | Cache frequently accessed data |
| D1 writes | 100k/day (free) | Batch writes when possible |

### Optimization Strategies

1. **Indicator Caching:** Cache indicator calculations for 1 minute
2. **Batch Queries:** Fetch all symbols in single broker query
3. **Connection Pooling:** Reuse broker connections
4. **Database Indexing:** Index frequently queried columns
5. **Pagination:** Limit API response sizes

### Horizontal Scaling

- Cloudflare Workers auto-scale horizontally
- No provisioning required
- Geographic edge distribution automatic
- D1 database scales transparently

---

## Future Enhancements

### Phase 2 Features

1. **Additional Indicators:**
   - Stochastic Oscillator
   - Williams %R
   - Fibonacci retracements

2. **Machine Learning:**
   - Signal classification with ML
   - Adaptive position sizing
   - Regime prediction

3. **Advanced Strategies:**
   - Pairs trading
   - Arbitrage
   - Options strategies

4. **Multi-Broker Support:**
   - Interactive Brokers
   - TD Ameritrade
   - Coinbase (crypto)

### Architecture Extensibility

The architecture supports:
- New indicators via plugin pattern
- New strategies via registry pattern
- New brokers via adapter pattern
- New risk checks via chain of responsibility

---

**End of Architecture Document**
