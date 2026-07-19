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
pnpm install
cp .env.example .env   # fill in your Hedera testnet credentials
pnpm dev
```

## Architecture

```
packages/
├── server/          Express API + x402 resource server + AI agent + HCS audit
└── web/             React dashboard (Vite)
```

## How It Works

1. Server exposes x402-protected data endpoints (weather, market data, tax compliance)
2. Agent receives a request (e.g. "get me the weather for NYC")
3. Agent uses `@x402/fetch` to pay for and fetch the data via Hedera micropayments
4. Payment settles on Hedera testnet — visible on HashScan
5. Every payment event is logged to an HCS topic — immutable audit trail

## Hedera Services Used

| Service | Purpose |
|---------|---------|
| **Hedera Token Service** | HBAR micropayments (~$0.0001/tx) for x402 settlements |
| **Hedera Consensus Service** | Immutable audit trail — every payment logged to HCS topic |
| **HashScan** | Block explorer — transaction verification and audit log viewer |

## x402 Protocol

x402 turns the HTTP 402 status code into a working payment standard. Clients pay per request using HBAR. On Hedera, transfers settle in seconds at ~$0.0001 per tx.

## License

Apache 2.0
