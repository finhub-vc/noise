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
