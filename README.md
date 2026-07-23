# pay-agent

An AI agent that autonomously discovers, purchases, and consumes data from x402-protected APIs on Hedera testnet. Every payment is logged to an immutable HCS audit trail.

## Real-World Application: Agentic Commerce Infrastructure

AI agents are becoming autonomous economic actors — trading bots, research assistants, compliance monitors — but there's no payment layer built for them. pay-agent solves this.

### The Problem

| Problem | Today | With pay-agent |
|---------|-------|----------------|
| AI agent needs live market data | Human signs up for $200/mo API subscription | Agent pays $0.002 per query |
| Startup wants to sell proprietary data | No micropayment infrastructure | Publish endpoint, get paid per access |
| Enterprise needs audit trail of agent spending | Manual reconciliation | HCS logs every payment immutably |
| Cross-border micropayments | 3-5 day settlement, 3% fees | Hedera settles in seconds, $0.0001 |

### Use Cases

- **Algorithmic Trading** — Bots buy real-time sentiment, on-chain data, news feeds per-query instead of $10K+/mo subscriptions. HCS satisfies SEC/MiFID II compliance.
- **AI/ML Data Pipeline** — Agents buy training data, inference, specialized APIs. Thousands of $0.001 transactions per day, impossible with credit cards.
- **Research Marketplace** — Researchers sell datasets and papers. Readers pay per access. No accounts, no KYC.
- **Supply Chain & ESG** — Companies buy verified carbon credits and compliance data. HCS creates auditable chain of custody.

## Quick Start

```bash
cd packages/server
pnpm install
cp .env.example .env   # fill in your Hedera testnet credentials
pnpm dev
```

In another terminal:
```bash
cd packages/web
pnpm install
pnpm dev
```

## Architecture

```
packages/server/
├── src/
│   ├── index.ts              # Entry point — registers providers, starts server
│   ├── config.ts             # Environment variable loading
│   ├── hedera.ts             # Hedera client + HCS helpers
│   ├── x402.ts               # Builds x402 paywall from registered providers
│   ├── providers/
│   │   ├── types.ts          # Provider interface
│   │   ├── registry.ts       # Dynamic registry + x402 route builder
│   │   ├── weather.ts        # Open-Meteo (free, real API)
│   │   ├── market.ts         # CoinGecko (free, real API)
│   │   └── compliance.ts     # Tax/regulatory data
│   ├── routes/
│   │   ├── providers.ts      # GET /api/providers
│   │   ├── data.ts           # GET /api/data/:provider
│   │   ├── audit.ts          # GET /api/audit
│   │   └── chat.ts           # POST /chat
│   └── tools/
│       └── agent.ts          # LangChain agent (tools built from providers)
packages/web/
├── src/
│   ├── App.tsx               # Dashboard — chat, providers, audit trail
│   └── index.css             # Dark terminal theme
└── vite.config.ts            # Dev proxy to server
```

## Provider System

The core architecture is a **provider registry**. Each data source implements a standard interface with a `fetch()` method that calls a real upstream API:

| Provider | Price | Upstream | Real Data |
|----------|-------|----------|-----------|
| Weather (`weather`) | $0.001 | Open-Meteo | Live geocoding + forecast |
| Crypto Market (`market`) | $0.002 | CoinGecko | Live prices, volume, market cap |
| Tax & Compliance (`compliance`) | $0.005 | Internal DB | Real tax rates by jurisdiction |

**Adding a new provider** = one file + one `registerProvider()` call. The x402 paywall, agent tools, and provider listing all build automatically.

## How x402 Works on Hedera

x402 turns the HTTP 402 status code into a working payment standard. On Hedera, the **fee-payer model** means the facilitator pays gas fees and submits transactions — the merchant never runs blockchain infrastructure.

1. Client requests a protected endpoint (e.g. `GET /api/data/weather?city=Tokyo`)
2. Server responds with HTTP 402 + `PaymentRequirements`
3. Client builds a Hedera `TransferTransaction`, partially signs it (facilitator is fee payer), Base64-encodes it
4. Server forwards the payload to the facilitator's `/verify` endpoint
5. Facilitator validates, adds its signature as fee payer, pays gas, and submits via `/settle`
6. Payment settles on Hedera testnet — visible on HashScan
7. Server responds with data + payment receipt
8. Every payment event is logged to an HCS topic — immutable audit trail

## Hedera Services Used

| Service | Purpose |
|---------|---------|
| **Hedera Token Service** | HBAR micropayments (~$0.0001/tx) for x402 settlements |
| **Hedera Consensus Service** | Immutable audit trail — every payment logged to HCS topic |
| **HashScan** | Block explorer — transaction verification and audit log viewer |

## Hedera `exact` Scheme

Hedera's contribution to x402 is the `exact` scheme, which pays a precise amount of HBAR or an HTS fungible token. Key properties:

- Protocol version: `x402Version: 2`
- Networks: `hedera:mainnet`, `hedera:testnet` (CAIP-2 identifiers)
- Assets: Native HBAR (entity ID `0.0.0`) or any HTS fungible token
- Amounts: HBAR in tinybars (1 HBAR = 10^8 tinybars)
- Fee model: Facilitator acts as `feePayer`, paying network fees and submitting the transaction

## Facilitator

This project uses [Blocky402](https://blocky402.com/), an open x402 facilitator with Hedera support. No API key required for testnet.

- Testnet URL: `https://api.testnet.blocky402.com`
- Fee payer account: `0.0.7162784`
- Docs: [blocky402.com/docs](https://blocky402.com/docs/)

## License

Apache 2.0
