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
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_asset_class ON positions(asset_class);
CREATE INDEX IF NOT EXISTS idx_positions_broker ON positions(broker);
