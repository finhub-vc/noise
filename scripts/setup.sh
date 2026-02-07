#!/bin/bash

# NOISE Trading Engine - Setup Script
# Creates D1 databases and outputs configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 NOISE Trading Engine - Setup"
echo "================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI not found. Install it with:"
    echo "   npm install -g wrangler"
    exit 1
fi

echo "✅ wrangler CLI found"
echo ""

# Create D1 databases
echo "📊 Creating D1 databases..."

# Development database
echo "  Creating noise-trading-dev..."
DEV_OUTPUT=$(wrangler d1 create noise-trading-dev 2>&1 || true)
DEV_DB_ID=$(echo "$DEV_OUTPUT" | grep -oP 'database_id = \K.*' | head -1)

if [ -z "$DEV_DB_ID" ]; then
    # Database might already exist, try to get its ID
    DEV_DB_ID=$(wrangler d1 list | grep "noise-trading-dev" | head -1 | grep -oP '^"\K[^"]+' || echo "")
fi

# Production database
echo "  Creating noise-trading-prod..."
PROD_OUTPUT=$(wrangler d1 create noise-trading-prod 2>&1 || true)
PROD_DB_ID=$(echo "$PROD_OUTPUT" | grep -oP 'database_id = \K.*' | head -1)

if [ -z "$PROD_DB_ID" ]; then
    PROD_DB_ID=$(wrangler d1 list | grep "noise-trading-prod" | head -1 | grep -oP '^"\K[^"]+' || echo "")
fi

echo ""
echo "✅ D1 databases created/located"
echo ""

# Update INFRASTRUCTURE.md
cat > "$PROJECT_ROOT/docs/INFRASTRUCTURE.md" << 'EOF'
# Infrastructure

## Cloudflare Resources

| Resource | Type | ID/Name | Created |
|----------|------|---------|---------|
| D1 Database (Dev) | D1 | {DEV_DB_ID} | $(date +%Y-%m-%d) |
| D1 Database (Prod) | D1 | {PROD_DB_ID} | $(date +%Y-%m-%d) |

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| CLOUDFLARE_API_TOKEN | GitHub Secrets, .env | Scoped API token for this project |
| CLOUDFLARE_ACCOUNT_ID | GitHub Secrets, .env | Cloudflare account ID |

## Deployment

Deploy via GitHub Actions or manually:
```bash
wrangler deploy
```

## Database IDs

- **Development**: {DEV_DB_ID}
- **Production**: {PROD_DB_ID}
EOF

# Portable sed replacement (works on both Linux and macOS)
sed -i.bak "s/{DEV_DB_ID}/$DEV_DB_ID/g" "$PROJECT_ROOT/docs/INFRASTRUCTURE.md"
sed -i.bak "s/{PROD_DB_ID}/$PROD_DB_ID/g" "$PROJECT_ROOT/docs/INFRASTRUCTURE.md"
rm -f "$PROJECT_ROOT/docs/INFRASTRUCTURE.md.bak"

echo "📝 Updated docs/INFRASTRUCTURE.md with database IDs"
echo ""

# Create .dev.vars for local development
DEV_VARS_FILE="$PROJECT_ROOT/.dev.vars"
if [ ! -f "$DEV_VARS_FILE" ]; then
    echo "🔐 Creating .dev.vars template..."
    cat > "$DEV_VARS_FILE" << 'EOF'
# NOISE Trading Engine - Local Development Environment Variables
# Copy from .env.example or fill in your values

NOISE_API_KEY=dev-api-key-change-me

# Tradovate (sandbox)
TRADOVATE_USERNAME=
TRADOVATE_PASSWORD=
TRADOVATE_APP_ID=
TRADOVATE_CID=
TRADOVATE_SECRET=

# Alpaca (paper)
ALPACA_API_KEY=
ALPACA_API_SECRET=

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
EOF
    echo "  Created .dev.vars (add your credentials)"
else
    echo "  .dev.vars already exists"
fi

echo ""
echo "================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add your broker credentials to .dev.vars"
echo "  2. Run database migrations: npm run db:migrate"
echo "  3. Start development server: npm run dev"
echo ""
