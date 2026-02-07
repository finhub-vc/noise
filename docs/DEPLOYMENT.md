# Deployment Guide

## Prerequisites

- Cloudflare account with Workers subscription
- Node.js 18+ installed locally
- Tradovate demo account credentials
- Alpaca paper trading account credentials
- Git

## Environment Setup

### 1. Install Dependencies

```bash
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure Secrets

Set up the following secrets using `npx wrangler secret put <NAME>`:

#### Broker Credentials

```bash
# Tradovate (Futures)
npx wrangler secret put TRADOVATE_USERNAME
npx wrangler secret put TRADOVATE_PASSWORD
npx wrangler secret put TRADOVATE_CLIENT_ID
npx wrangler secret put TRADOVATE_CLIENT_SECRET
npx wrangler secret put TRADOVATE_APP_ID
npx wrangler secret put TRADOVATE_CID

# Alpaca (Equities)
npx wrangler secret put ALPACA_API_KEY
npx wrangler secret put ALPACA_API_SECRET
```

#### API Keys (Optional)

```bash
# For API authentication
npx wrangler secret put NOISE_API_KEY
```

## Database Setup

### 1. Create D1 Database

```bash
npx wrangler d1 create noise-db --env production
```

Note the `database_id` from the output.

### 2. Update wrangler.toml

Add the database binding to your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "noise-db"
database_id = "<your-database-id>"
```

### 3. Run Migrations

```bash
npm run db:migrate
```

## Deployment

### Deploy API Worker

```bash
npm run deploy
```

This will:
1. Build the TypeScript code
2. Deploy to Cloudflare Workers
3. Apply any pending migrations

### Deploy Dashboard

The dashboard is a static site that can be deployed to:

#### Cloudflare Pages (Recommended)

```bash
cd dashboard
npm run build
npx wrangler pages deploy dist --project-name=noise-dashboard
```

#### Cloudflare Workers (Alternative)

```bash
cd dashboard
npm run build
npx wrangler deploy
```

## Post-Deployment

### 1. Verify API

```bash
curl https://noise-api.your-subdomain.workers.dev/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1234567890
}
```

### 2. Configure Dashboard

Update `dashboard/.env.production`:

```env
VITE_API_URL=https://noise-api.your-subdomain.workers.dev
```

### 3. Test End-to-End

1. Open dashboard URL
2. Verify account data loads
3. Check positions display
4. Test risk metrics
5. Verify signals panel

## Monitoring

### Logs

View real-time logs:

```bash
npx wrangler tail --env production
```

### Metrics

Access metrics via:
- Cloudflare Dashboard > Workers > Your Worker
- Check request count, errors, CPU usage

## Rollback

If issues occur:

```bash
# Revert to previous version
git revert HEAD
git push

# Redeploy
npm run deploy
```

## Troubleshooting

### Database Issues

```bash
# Check database status
npx wrangler d1 info noise-db

# Backup database
npx wrangler d1 export noise-db --output=backup.sql
```

### Secrets Issues

```bash
# List all secrets
npx wrangler secret list

# Update a secret
npx wrangler secret put <SECRET_NAME>
```

### Worker Errors

Check logs for specific errors:
- `failed to connect to broker`: Check credentials
- `D1_ERROR`: Check database configuration
- `CORS error`: Check CORS configuration in middleware
