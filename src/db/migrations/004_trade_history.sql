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
