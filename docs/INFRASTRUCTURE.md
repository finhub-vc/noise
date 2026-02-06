# Infrastructure

## Cloudflare Resources

| Resource | Type | ID/Name | Created |
|----------|------|---------|---------|
| D1 Database (Dev) | D1 |  | $(date +%Y-%m-%d) |
| D1 Database (Prod) | D1 |  | $(date +%Y-%m-%d) |

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

- **Development**: 
- **Production**: 
