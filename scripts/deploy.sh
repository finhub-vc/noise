#!/bin/bash

# NOISE Trading Engine - Deploy Script

set -e

ENVIRONMENT="${1:-development}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 NOISE Trading Engine - Deploy"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Run migrations first
echo "📊 Running database migrations..."
if [ "$ENVIRONMENT" = "production" ]; then
    npm run db:migrate:prod
else
    npm run db:migrate
fi

echo ""
echo "📦 Deploying to Cloudflare Workers..."
if [ "$ENVIRONMENT" = "production" ]; then
    wrangler deploy --env production
else
    wrangler deploy --env development
fi

echo ""
echo "================================"
echo "✅ Deploy complete!"
echo ""
