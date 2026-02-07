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
