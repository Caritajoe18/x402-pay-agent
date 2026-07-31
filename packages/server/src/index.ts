import "@hashgraph/hedera-agent-kit";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { ensureHcsTopic, checkBalance } from "./hedera.js";
import { registerProvider } from "./providers/registry.js";
import { marketProvider } from "./providers/market.js";
import { complianceProvider } from "./providers/compliance.js";
import { sentimentProvider } from "./providers/sentiment.js";
import { esgProvider } from "./providers/esg.js";
import { weatherProvider } from "./providers/weather.js";
import { createX402Middleware } from "./x402.js";
import routes from "./routes/index.js";

// ── Register data providers ─────────────────────────────────────────────────
registerProvider(marketProvider);
registerProvider(complianceProvider);
registerProvider(sentimentProvider);
registerProvider(esgProvider);
registerProvider(weatherProvider);

// ── Express ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// x402 paywall — built from registered providers
app.use(createX402Middleware());

// routes
app.use(routes);

// health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    network: "hedera:testnet",
    payTo: config.hedera.accountId,
    topicId: config.hcs.topicId,
  });
});

// start
app.listen(config.port, async () => {
  try {
    await checkBalance();
    await ensureHcsTopic();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pay-agent] Startup error: ${msg}`);
    console.error("[pay-agent] Server started but HCS audit trail is unavailable");
  }
  console.log(`[pay-agent] Server running on http://localhost:${config.port}`);
  console.log(`[pay-agent] Paying to: ${config.hedera.accountId}`);
  console.log(`[pay-agent] Facilitator: ${config.facilitator.url}`);
});
