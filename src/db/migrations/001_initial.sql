-- Migration 001: Initial Setup
-- Create migrations tracking table

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
