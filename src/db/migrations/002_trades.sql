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
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_signal_id ON trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_trades_broker_order_id ON trades(broker_order_id);
