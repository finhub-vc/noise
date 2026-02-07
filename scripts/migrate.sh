#!/bin/bash

# NOISE Trading Engine - Database Migration Script

set -e

ENV="${1:-dev}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_NAME="noise-trading-${ENV}"
MIGRATIONS_DIR="$PROJECT_ROOT/src/db/migrations"

echo "📊 NOISE Database Migration"
echo "================================"
echo "Environment: $ENV"
echo "Database: $DB_NAME"
echo ""

# Create bundle SQL file
BUNDLE_FILE="$PROJECT_ROOT/src/db/migrations/bundle.sql"
echo "Creating migration bundle..."

: > "$BUNDLE_FILE"

for migration in "$MIGRATIONS_DIR"/[0-9]*.sql; do
    filename=$(basename "$migration")
    echo "  Including $filename"
    echo "-- Migration: $filename" >> "$BUNDLE_FILE"
    cat "$migration" >> "$BUNDLE_FILE"
    echo "" >> "$BUNDLE_FILE"
done

echo ""
echo "Executing migrations..."
wrangler d1 execute "$DB_NAME" --file="$BUNDLE_FILE"

echo ""
echo "================================"
echo "✅ Migrations complete!"
echo ""
