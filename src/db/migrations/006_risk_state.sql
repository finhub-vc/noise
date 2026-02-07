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
