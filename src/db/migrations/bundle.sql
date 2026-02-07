-- Migration 001: Initial Setup
-- Create migrations tracking table

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
-- Migration 002: Trades Table

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK(asset_class IN ('FUTURES', 'EQUITY')),
  broker TEXT NOT NULL CHECK(broker IN ('TRADOVATE', 'ALPACA')),
  client_order_id TEXT NOT NULL UNIQUE,
  broker_order_id TEXT,
  side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
  quantity REAL NOT NULL,
  order_type TEXT NOT NULL CHECK(order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
  limit_price REAL,
  stop_price REAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED')),
  filled_quantity REAL DEFAULT 0,
  avg_fill_price REAL,
  signal_id TEXT,
  signal_strength REAL,
  created_at INTEGER NOT NULL,
  filled_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'subpath') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_signal_id ON trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_trades_broker_order_id ON trades(broker_order_id);
-- Migration 003: Positions Table

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  asset_class TEXT NOT NULL CHECK(asset_class IN ('FUTURES', 'EQUITY')),
  broker TEXT NOT NULL CHECK(broker IN ('TRADOVATE', 'ALPACA')),
  side TEXT NOT NULL CHECK(side IN ('LONG', 'SHORT')),
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  current_price REAL NOT NULL,
  market_value REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'subpath') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_asset_class ON positions(asset_class);
CREATE INDEX IF NOT EXISTS idx_positions_broker ON positions(broker);
-- Migration 004: Trade History Table

CREATE TABLE IF NOT EXISTS trade_history (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK(asset_class IN ('FUTURES', 'EQUITY')),
  broker TEXT NOT NULL CHECK(broker IN ('TRADOVATE', 'ALPACA')),
  side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  quantity REAL NOT NULL,
  net_pnl REAL NOT NULL,
  pnl_percent REAL NOT NULL,
  entry_at INTEGER NOT NULL,
  exit_at INTEGER NOT NULL,
  hold_duration_minutes INTEGER NOT NULL,
  signal_id TEXT,
  strategy TEXT
);

CREATE INDEX IF NOT EXISTS idx_trade_history_symbol ON trade_history(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_history_exit_at ON trade_history(exit_at);
-- Migration 005: Signals Table

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK(asset_class IN ('FUTURES', 'EQUITY')),
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT', 'NEUTRAL')),
  strength REAL NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss REAL NOT NULL,
  take_profit REAL,
  risk_reward_ratio REAL,
  source TEXT NOT NULL,
  indicators TEXT NOT NULL, -- JSON string
  reasons TEXT NOT NULL, -- JSON array string
  regime TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  executed_at INTEGER,
  cancelled_at INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXECUTED', 'EXPIRED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_expires_at ON signals(expires_at);
CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source);
-- Migration 006: Risk State Table

CREATE TABLE IF NOT EXISTS risk_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  start_of_day_equity REAL NOT NULL DEFAULT 0,
  start_of_week_equity REAL NOT NULL DEFAULT 0,
  peak_equity REAL NOT NULL DEFAULT 0,
  current_equity REAL NOT NULL DEFAULT 0,
  daily_pnl REAL NOT NULL DEFAULT 0,
  daily_pnl_percent REAL NOT NULL DEFAULT 0,
  weekly_pnl REAL NOT NULL DEFAULT 0,
  weekly_pnl_percent REAL NOT NULL DEFAULT 0,
  max_drawdown REAL NOT NULL DEFAULT 0,
  max_drawdown_percent REAL NOT NULL DEFAULT 0,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  consecutive_wins INTEGER NOT NULL DEFAULT 0,
  today_trade_count INTEGER NOT NULL DEFAULT 0,
  circuit_breaker_triggered INTEGER DEFAULT 0,
  circuit_breaker_until INTEGER,
  circuit_breaker_reason TEXT,
  circuit_breaker_type TEXT,
  day_trades_used INTEGER DEFAULT 0,
  day_trades_remaining INTEGER DEFAULT 3,
  trading_day TEXT NOT NULL,
  last_updated INTEGER NOT NULL
);

-- Ensure only one row exists
INSERT OR IGNORE INTO risk_state (id, trading_day, last_updated)
VALUES (1, DATE('now'), strftime('%s', 'now') * 1000);
-- Migration 007: Daily Metrics Table

CREATE TABLE IF NOT EXISTS daily_metrics (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  trades_count INTEGER NOT NULL DEFAULT 0,
  wins_count INTEGER NOT NULL DEFAULT 0,
  losses_count INTEGER NOT NULL DEFAULT 0,
  win_rate REAL NOT NULL DEFAULT 0,
  net_pnl REAL NOT NULL DEFAULT 0,
  pnl_percent REAL NOT NULL DEFAULT 0,
  gross_profit REAL NOT NULL DEFAULT 0,
  gross_loss REAL NOT NULL DEFAULT 0,
  profit_factor REAL NOT NULL DEFAULT 0,
  largest_win REAL NOT NULL DEFAULT 0,
  largest_loss REAL NOT NULL DEFAULT 0,
  avg_win REAL NOT NULL DEFAULT 0,
  avg_loss REAL NOT NULL DEFAULT 0,
  avg_trade REAL NOT NULL DEFAULT 0,
  sharpe_ratio REAL,
  max_drawdown REAL NOT NULL DEFAULT 0,
  max_drawdown_percent REAL NOT NULL DEFAULT 0,
  equity_start REAL NOT NULL DEFAULT 0,
  equity_end REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
-- Migration 008: Equity Curve Table

CREATE TABLE IF NOT EXISTS equity_curve (
  timestamp INTEGER PRIMARY KEY,
  equity REAL NOT NULL,
  cash REAL NOT NULL,
  positions_value REAL NOT NULL,
  total_exposure REAL NOT NULL,
  open_positions INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_equity_curve_timestamp ON equity_curve(timestamp);
-- Migration 009: Audit Log Table

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  category TEXT NOT NULL CHECK(category IN ('ORDER', 'RISK', 'SIGNAL', 'BROKER', 'SYSTEM', 'AUTH', 'CONFIG')),
  message TEXT NOT NULL,
  context TEXT, -- JSON string
  related_entity_id TEXT,
  related_entity_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log(category);
CREATE INDEX IF NOT EXISTS idx_audit_log_related_entity ON audit_log(related_entity_id, related_entity_type);
