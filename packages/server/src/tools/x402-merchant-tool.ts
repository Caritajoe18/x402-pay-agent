import { z } from "zod";
import { BaseTool, type Plugin } from "@hashgraph/hedera-agent-kit";
import { getFetchWithPayment } from "../x402-client.js";
import { logToHcs } from "../hedera.js";
import {
  spendTracker,
  SetMaxSpendTool,
  GetSpendReportTool,
} from "./spend-tracker.js";

export const FETCH_X402_MERCHANT_TOOL = "fetch_x402_merchant";

export const PRICE_MAP: Record<string, string> = {
  "/api/data/market": "$0.002",
  "/api/data/sentiment": "$0.002",
  "/api/data/compliance": "$0.003",
  "/api/data/esg": "$0.003",
  "/api/data/weather": "$0.001",
  "/api/marketplace/btc-onchain": "$0.001",
  "/api/marketplace/eth-gas": "$0.001",
  "/api/marketplace/macro-indicators": "$0.005",
  "/api/marketplace/defi-tvl": "$0.003",
  "/api/marketplace/sentiment-composite": "$0.002",
};

export function lookupPrice(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    return PRICE_MAP[path] ?? null;
  } catch {
    return null;
  }
}

const fetchX402MerchantParams = z.object({
  url: z.string().describe("The x402-protected merchant endpoint URL"),
  params: z
    .record(z.string(), z.string())
    .optional()
    .describe("Optional query parameters for the merchant endpoint"),
});

class FetchX402MerchantTool extends BaseTool {
  method = FETCH_X402_MERCHANT_TOOL;
  name = "Fetch x402 Merchant";
  description: string;
  parameters: any;

  constructor() {
    super();
    this.description =
      "Fetch data from any x402-protected merchant endpoint. Autonomously handles the full x402 handshake: receives the 402 challenge, signs a Hedera TransferTransaction, settles via Blocky402 facilitator, and receives the data. Input: JSON with 'url' (merchant endpoint) and optional 'params' (query parameters).";
    this.parameters = fetchX402MerchantParams;
  }

  async normalizeParams(params: {
    url: string;
    params?: Record<string, string>;
  }): Promise<{ url: string; params?: Record<string, string> }> {
    return params;
  }

  async coreAction(normalisedParams: {
    url: string;
    params?: Record<string, string>;
  }) {
    const url = normalisedParams.url;
    if (!url) {
      const message = "url is required";
      return { raw: { error: message }, humanMessage: message };
    }

    const price = lookupPrice(url);
    const qs = new URLSearchParams(normalisedParams.params || {}).toString();
    const fullUrl = qs ? `${url}?${qs}` : url;

    try {
      const fetchWithPayment = getFetchWithPayment();
      const res = await fetchWithPayment(fullUrl);
      const status = res.status;
      const body = await res.json().catch(() => null);

      if (status === 200 && price) {
        spendTracker.recordSpend(price);
      }

      const settlementHeader = res.headers.get("x-payment-response");
      let settlement = null;
      if (settlementHeader) {
        try {
          settlement = JSON.parse(atob(settlementHeader));
        } catch { /* skip */ }
      }

      await logToHcs({
        event: "x402_merchant_purchase",
        url: fullUrl,
        status,
        price,
        settlement,
        timestamp: new Date().toISOString(),
      });

      const spendReport = spendTracker.getReport();
      const raw = {
        url: fullUrl,
        status,
        price,
        data: body,
        settlement,
        spendReport,
        transactionId: settlement?.transactionId ?? null,
      };
      const humanMessage =
        status === 200
          ? `Fetched ${fullUrl} (${price ?? "price not listed"}). ${spendReport}`
          : `Request to ${fullUrl} returned HTTP ${status}`;
      return { raw, humanMessage };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        raw: { error: message, spendReport: spendTracker.getReport() },
        humanMessage: message,
      };
    }
  }

  async shouldSecondaryAction(): Promise<boolean> {
    return false;
  }

  async secondaryAction(request: unknown) {
    return request;
  }

  async handleError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const blockedByPolicy = message.includes("blocked by policy");
    const humanMessage = blockedByPolicy
      ? `Purchase blocked by Max Spend Policy.\n${spendTracker.getReport()}`
      : `Failed to execute ${this.name}: ${message}`;
    return {
      raw: {
        error: message,
        blockedByPolicy,
        spendReport: spendTracker.getReport(),
      },
      humanMessage,
    };
  }
}

export function createPaymentsPlugin(): Plugin {
  return {
    name: "payments-plugin",
    version: "1.0.0",
    description:
      "x402 micropayment tools: fetch_x402_merchant, set_max_spend, get_spend_report",
    tools: () => [
      new FetchX402MerchantTool(),
      new SetMaxSpendTool(),
      new GetSpendReportTool(),
    ],
  };
}
