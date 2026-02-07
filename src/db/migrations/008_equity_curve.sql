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
