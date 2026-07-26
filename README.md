# pay-agent: Autonomous Micropayments for Agentic Commerce Infrastructure

**pay-agent** is an autonomous AI agent that discovers, purchases, and consumes data from **x402-protected APIs** on the Hedera testnet. By turning the HTTP 402 "Payment Required" status code into a functional payment standard, this project enables AI agents to function as **independent economic actors** that manage their own budgets without human intervention or pre-configured API keys.

---

### The Problem & Solution
The project addresses the core friction in machine-to-machine commerce, replacing rigid subscriptions with fluid micropayments.

| Problem | Today | With pay-agent |
| :--- | :--- | :--- |
| **API Access** | Humans sign up for $200/mo subscriptions | Agents pay **$0.002 per query** |
| **Data Monetization** | No infrastructure for micropayments | Publish endpoint, get paid per access |
| **Auditability** | Manual reconciliation of spending | **HCS logs every payment** immutably |
| **Fees & Speed** | 3-5 day settlement, 3% fees | Hedera settles in seconds for **$0.0001** |
(Sources:)

---

### Direct Merchant Interaction
Unlike traditional systems limited by pre-defined integrations, **pay-agent runs entirely on Direct Merchant Interaction**. This architecture allows the agent to function as a universal "browser for machine commerce," interacting with any third-party merchant in the x402 ecosystem.

#### How Any API Becomes a Merchant
The agent can interact with any existing web service converted into an x402 merchant. Using the **mppx library**, developers can wrap standard APIs (such as specialized research databases or supply chain trackers) with an **HTTP 402 paywall**. This allows the agent to discover, pay for, and consume that data autonomously on the Hedera testnet without prior configuration.

#### Merchant Ecosystem
The agent is compatible with a wide range of real-world merchants and service protocols:
*   **AI & Inference**: Purchase text completions from an **OpenAI Proxy** ($0.005/request) or pay per image via **Photo Generation APIs**.
*   **Financial Services**: Access **SaucerSwap** for on-chain token exchanges, **Stripe Proxy** for traditional gateway access ($0.01 fee), or **Memejob** for managing speculative assets.
*   **Oracles & Data**: Real-time, high-fidelity feeds from **Pyth Network** and **Chainlink**.
*   **Identity & Compliance**: Pay **Terminal 3 (T3N)** for verified identity disclosure or unlock files via the **S3 Data Marketplace**.

---

### Use Case Scenarios

#### 1. The "Precision Alpha" Trader
A quantitative trader uses the agent to buy real-time sentiment and market data per-query instead of five-figure monthly subscriptions.
*   **Just-in-Time Purchase**: When a trade signal is needed, the agent hits an oracle merchant (e.g., Pyth), receives an **HTTP 402 challenge**, and settles it instantly.
*   **Autonomous Execution**: The agent uses its budget to execute token swaps on **SaucerSwap**.
*   **Immutable Compliance**: Every transaction is logged to **HCS**, satisfying SEC or MiFID II audit requirements.

#### 2. The "Campaign-in-a-Box" Agent
This application transforms a standard bot into an **Autonomous Creative Studio** acting as an independent contractor.
*   **The Brief**: A user requests: *"Create a marketing slogan and a hero image for 'Solar Brew' coffee"*.
*   **Autonomous Settlement**: The agent identifies an **OpenAI Proxy** for text and a **Photo Generation API** for images, paying each merchant one-by-one as needed.
*   **Audit Trail**: Every cent spent is notarized on a **Hedera Consensus Service (HCS)** topic, providing an immutable record for the business.

---

### The Universal Handshake Flow
Regardless of the merchant, the agent follows a standardized autonomous flow:
1.  **Discovery**: The agent identifies a target merchant endpoint.
2.  **Challenge**: The server responds with **HTTP 402 + PaymentRequirements**.
3.  **Signing**: The agent signs a **Hedera TransferTransaction** (using the **Blocky402 facilitator** as the fee payer).
4.  **Settlement**: Blocky402 validates and submits the transaction to the Hedera testnet.
5.  **Fulfillment**: Once verified on **HashScan**, the merchant releases the data and the event is logged to the **HCS Audit Trail**.

---

### Architecture
```
packages/server/
├── src/
│   ├── index.ts              # Entry point — starts server
│   ├── config.ts             # Environment config (server + client identities)
│   ├── hedera.ts             # Hedera client + HCS audit helpers
│   ├── x402.ts               # Server-side x402 paywall middleware
│   ├── x402-client.ts        # Client-side x402 (wrapFetchWithPayment)
│   ├── routes/
│   │   ├── index.ts          # Route aggregator
│   │   ├── audit.ts          # GET /api/audit (Fetch HCS logs)
│   │   ├── chat.ts           # POST /chat (AI Agent interface)
│   │   ├── providers.ts      # GET /api/providers (list built-in providers)
│   │   └── data.ts           # GET /api/data/:provider (direct data access)
│   ├── tools/
│   │   └── agent.ts          # LangChain agent with x402 merchant tools
│   └── providers/
│       ├── types.ts          # Provider interface
│       ├── registry.ts       # Provider registry + x402 route builder
│       ├── market.ts         # CoinGecko market data
│       ├── compliance.ts     # Tax & regulatory data
│       ├── sentiment.ts      # News sentiment data
│       └── esg.ts            # Carbon credits & ESG data
```
(Sources:)

### Quick Start
```bash
# Server setup
cd packages/server && pnpm install
cp .env.example .env   # Add Hedera testnet credentials
pnpm dev

# Web Dashboard setup
cd packages/web && pnpm install
pnpm dev
```

### Bounty Alignment
*   **Architecture**: Aligns with **Reference Architecture 1**: An agent that pays per query. Implements **Direct Merchant Interaction** for universal x402 commerce.
*   **Hedera Rails**: Utilizes **HTS** for low-fee ($0.0001) micropayments and **HCS** for enterprise-grade transparency. Uses **Blocky402 facilitator** as fee-payer.
*   **Standard Usage**: Implements the open-source **x402 protocol** for machine-to-machine commerce using `@x402/express`, `@x402/fetch`, `@x402/hedera`, and `@x402/core`.

**License**: Apache 2.0