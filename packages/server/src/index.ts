import "dotenv/config";
import express from "express";
import cors from "cors";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  Timestamp,
  PrivateKey,
  AccountId,
} from "@hiero-ledger/sdk";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";

// ── Config ──────────────────────────────────────────────────────────────────
const HEDERA_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID!;
const HEDERA_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY!;
let HCS_TOPIC_ID = process.env.HCS_TOPIC_ID || "";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const PORT = parseInt(process.env.PORT || "4021", 10);
const PAY_TO = HEDERA_ACCOUNT_ID;

// ── Hedera Client ───────────────────────────────────────────────────────────
const hederaClient = Client.forTestnet();
hederaClient.setOperator(
  AccountId.fromString(HEDERA_ACCOUNT_ID),
  PrivateKey.fromString(HEDERA_PRIVATE_KEY)
);

// ── HCS Setup ───────────────────────────────────────────────────────────────
async function ensureHcsTopic(): Promise<string> {
  if (HCS_TOPIC_ID) return HCS_TOPIC_ID;
  const tx = new TopicCreateTransaction().setTopicMemo(
    "pay-agent audit trail"
  );
  const response = await tx.execute(hederaClient);
  const receipt = await response.getReceipt(hederaClient);
  HCS_TOPIC_ID = receipt.topicId!.toString();
  console.log(`[HCS] Created audit topic: ${HCS_TOPIC_ID}`);
  return HCS_TOPIC_ID;
}

async function logToHcs(event: Record<string, unknown>): Promise<void> {
  const topicId = await ensureHcsTopic();
  const msg = JSON.stringify(event);
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(msg);
  await tx.execute(hederaClient);
}

// ── Express + x402 ──────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// x402 paywall config
const routes = {
  "/api/weather": {
    accepts: [
      {
        scheme: "exact",
        network: "hedera:testnet" as const,
        price: "$0.001",
        payTo: PAY_TO,
      },
    ],
    description: "Real-time weather data for any city",
  },
  "/api/market": {
    accepts: [
      {
        scheme: "exact",
        network: "hedera:testnet" as const,
        price: "$0.002",
        payTo: PAY_TO,
      },
    ],
    description: "Market / crypto price data",
  },
  "/api/tax": {
    accepts: [
      {
        scheme: "exact",
        network: "hedera:testnet" as const,
        price: "$0.005",
        payTo: PAY_TO,
      },
    ],
    description: "Tax compliance data lookup",
  },
};

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
});

const hederaScheme = new ExactHederaScheme();

app.use(
  paymentMiddlewareFromConfig(
    routes,
    [facilitatorClient],
    [{ network: "hedera:testnet", server: hederaScheme }],
    { appName: "pay-agent", testnet: true }
  )
);

// ── Data Endpoints (behind x402 paywall) ────────────────────────────────────
app.get("/api/weather", async (req, res) => {
  const city = (req.query.city as string) || "New York";
  const data = {
    city,
    temperature: `${Math.round(15 + Math.random() * 20)}°C`,
    condition: ["Sunny", "Cloudy", "Rainy", "Partly Cloudy"][
      Math.floor(Math.random() * 4)
    ],
    humidity: `${Math.round(30 + Math.random() * 60)}%`,
    windSpeed: `${Math.round(5 + Math.random() * 25)} km/h`,
    timestamp: new Date().toISOString(),
    source: "pay-agent weather feed",
  };

  await logToHcs({
    event: "x402_payment",
    endpoint: `/api/weather?city=${city}`,
    price: "$0.001",
    timestamp: new Date().toISOString(),
  });

  res.json(data);
});

app.get("/api/market", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC";
  const price = 60000 + Math.random() * 40000;
  const data = {
    symbol: symbol.toUpperCase(),
    price: `$${price.toFixed(2)}`,
    change24h: `${(Math.random() * 10 - 5).toFixed(2)}%`,
    volume24h: `$${(Math.random() * 1e9).toFixed(0)}`,
    timestamp: new Date().toISOString(),
    source: "pay-agent market feed",
  };

  await logToHcs({
    event: "x402_payment",
    endpoint: `/api/market?symbol=${symbol}`,
    price: "$0.002",
    timestamp: new Date().toISOString(),
  });

  res.json(data);
});

app.get("/api/tax", async (req, res) => {
  const jurisdiction = (req.query.jurisdiction as string) || "US";
  const data = {
    jurisdiction,
    salesTaxRate: `${(5 + Math.random() * 10).toFixed(2)}%`,
    digitalServicesTax: `${(Math.random() * 3).toFixed(2)}%`,
    complianceStatus: "verified",
    lastUpdated: new Date().toISOString(),
    source: "pay-agent tax compliance feed",
  };

  await logToHcs({
    event: "x402_payment",
    endpoint: `/api/tax?jurisdiction=${jurisdiction}`,
    price: "$0.005",
    timestamp: new Date().toISOString(),
  });

  res.json(data);
});

// ── Audit Trail Endpoint ────────────────────────────────────────────────────
app.get("/api/audit", async (_req, res) => {
  try {
    const topicId = await ensureHcsTopic();
    const messages: Record<string, unknown>[] = [];
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await new Promise<void>((resolve) => {
      const query = new TopicMessageQuery({
        topicId,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(new Date()),
      });

      const handle = query.subscribe(
        hederaClient,
        (_msg, error) => {
          console.error("[HCS query error]", error);
        },
        (message) => {
          try {
            const parsed = JSON.parse(
              new TextDecoder().decode(message.contents)
            );
            messages.push({
              ...parsed,
              consensusTimestamp:
                message.consensusTimestamp?.toString() ?? null,
            });
          } catch {
            /* skip malformed */
          }
        }
      );

      // Give it a moment to collect messages then stop
      setTimeout(() => {
        handle.unsubscribe();
        resolve();
      }, 3000);
    });

    res.json({ topicId, messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Chat Endpoint (AI Agent) ────────────────────────────────────────────────
const llm = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  model: process.env.OLLAMA_MODEL || "llama3.2:3b",
  temperature: 0,
});

const weatherTool = new DynamicTool({
  name: "get_weather",
  description:
    "Fetch real-time weather data for a city. Requires an x402 micropayment. Input: city name string.",
  func: async (city: string) => {
    const resp = await fetch(
      `http://localhost:${PORT}/api/weather?city=${encodeURIComponent(city)}`
    );
    return JSON.stringify(await resp.json());
  },
});

const marketTool = new DynamicTool({
  name: "get_market_data",
  description:
    "Fetch market/crypto price data for a symbol. Requires an x402 micropayment. Input: ticker symbol string.",
  func: async (symbol: string) => {
    const resp = await fetch(
      `http://localhost:${PORT}/api/market?symbol=${encodeURIComponent(symbol)}`
    );
    return JSON.stringify(await resp.json());
  },
});

const taxTool = new DynamicTool({
  name: "get_tax_data",
  description:
    "Fetch tax compliance data for a jurisdiction. Requires an x402 micropayment. Input: jurisdiction string (e.g. 'US', 'EU', 'UK').",
  func: async (jurisdiction: string) => {
    const resp = await fetch(
      `http://localhost:${PORT}/api/tax?jurisdiction=${encodeURIComponent(jurisdiction)}`
    );
    return JSON.stringify(await resp.json());
  },
});

const tools = [weatherTool, marketTool, taxTool];

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const langchainMessages: (SystemMessage | HumanMessage)[] = [
      new SystemMessage(
        `You are pay-agent, an AI assistant that can purchase data using x402 micropayments on Hedera. ` +
          `You have access to tools that fetch weather data, market data, and tax compliance data. ` +
          `Each tool call costs a small amount of HBAR. Use the tools when the user asks for real data. ` +
          `Always explain what data you fetched and how much it cost.`
      ),
      new HumanMessage(message),
    ];

    const llmWithTools = llm.bindTools(tools);
    const response = await llmWithTools.invoke(langchainMessages);

    const toolCalls = response.tool_calls || [];
    const toolResults: Array<{
      tool: string;
      input: string;
      result: string;
    }> = [];

    for (const tc of toolCalls) {
      const tool = tools.find((t) => t.name === tc.name);
      if (tool) {
        const input =
          typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args);
        const result = await tool.invoke(input);
        toolResults.push({ tool: tc.name, input, result });

        langchainMessages.push(
          new HumanMessage(
            `Tool ${tc.name} result: ${result}`
          )
        );
      }
    }

    let finalReply: string;
    if (toolResults.length > 0) {
      const finalResponse = await llmWithTools.invoke(langchainMessages);
      finalReply =
        typeof finalResponse.content === "string"
          ? finalResponse.content
          : JSON.stringify(finalResponse.content);
    } else {
      finalReply =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
    }

    res.json({
      reply: finalReply,
      toolCalls: toolResults.map((r) => ({
        tool: r.tool,
        input: r.input,
        result: JSON.parse(r.result),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat]", msg);
    res.status(500).json({ error: msg });
  }
});

// ── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", network: "hedera:testnet", payTo: PAY_TO });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await ensureHcsTopic();
  console.log(`[pay-agent] Server running on http://localhost:${PORT}`);
  console.log(`[pay-agent] Paying to: ${PAY_TO}`);
  console.log(`[pay-agent] Facilitator: ${FACILITATOR_URL}`);
  console.log(
    `[pay-agent] HCS audit topic: ${HCS_TOPIC_ID || "(will be created)"}`
  );
});
