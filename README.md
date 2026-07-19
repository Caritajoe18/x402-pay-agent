# pay-agent

An AI agent that autonomously discovers, purchases, and consumes data from x402-protected APIs on Hedera testnet.

## Quick Start

```bash
pnpm install
cp .env.example .env   # fill in your Hedera testnet credentials
pnpm dev
```

## Architecture

- `packages/server` — Express API with x402 resource server + AI agent
- `packages/web` — React dashboard (Vite)

## How It Works

1. Server exposes x402-protected data endpoints (weather, market data, tax compliance)
2. Agent receives a request (e.g. "get me the weather for NYC")
3. Agent uses `@x402/fetch` to pay for and fetch the data via Hedera micropayments
4. Payment settles on Hedera testnet — visible on HashScan

## x402 Protocol

x402 turns the HTTP 402 status code into a working payment standard. Clients pay per request using stablecoins or HBAR. On Hedera, transfers settle in seconds at ~$0.0001 per tx.
