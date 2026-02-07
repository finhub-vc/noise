# NOISE

**Networked Optimization for Intelligent Signal Execution**

A serverless algorithmic trading engine built on Cloudflare Workers, targeting 10% monthly returns through automated momentum, mean-reversion, and breakout strategies.

## Features

- **Serverless Architecture**: Cloudflare Workers + D1 database
- **Dual-Broker**: Tradovate (futures) + Alpaca (equities)
- **Risk Management**: Multi-layer circuit breakers, position sizing, exposure limits
- **Signal Generation**: RSI, MACD, Bollinger Bands, ATR, ADX indicators
- **Real-time Dashboard**: React-based monitoring interface

## Quick Start

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Create D1 databases (requires wrangler)
./scripts/setup.sh

# Run database migrations
npm run db:migrate

# Local development
npm run dev

# Deploy to development
npm run deploy:dev
```

## Project Structure

```
noise/
├── src/                    # Cloudflare Worker
│   ├── types/             # TypeScript type definitions
│   ├── config/            # Configuration defaults
│   ├── utils/             # Utility functions
│   ├── risk/              # Risk management
│   ├── signals/           # Signal generation
│   ├── db/                # Database layer
│   ├── brokers/           # Broker adapters
│   └── index.ts           # Main worker
├── dashboard/             # React dashboard
├── scripts/               # Deployment scripts
├── tests/                 # Test files
└── docs/                  # Documentation
```

## Documentation

- [PRD](docs/PRD.md) - Product Requirements
- [EPICS](docs/EPICS.md) - User Stories
- [ARCHITECTURE](docs/ARCHITECTURE.md) - Technical Design
- [PROGRESS](docs/PROGRESS.md) - Implementation Status

## License

Proprietary - CloudMind Inc.
