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
