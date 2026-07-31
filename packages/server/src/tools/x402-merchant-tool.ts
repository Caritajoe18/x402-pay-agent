import { DynamicTool } from "@langchain/core/tools";
import { getFetchWithPayment } from "../x402-client.js";
import { logToHcs } from "../hedera.js";
import { spendTracker } from "./spend-tracker.js";

const PRICE_MAP: Record<string, string> = {
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

function lookupPrice(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    return PRICE_MAP[path] ?? null;
  } catch {
    return null;
  }
}

export function createX402MerchantTool() {
  return new DynamicTool({
    name: "fetch_x402_merchant",
    description:
      "Fetch data from any x402-protected merchant endpoint. Autonomously handles the full x402 handshake: receives the 402 challenge, signs a Hedera TransferTransaction, settles via Blocky402 facilitator, and receives the data. Input: JSON with 'url' (merchant endpoint) and optional 'params' (query parameters).",
    func: async (input: string) => {
      let url: string;
      let params: Record<string, string> = {};
      try {
        const parsed = JSON.parse(input);
        const inner = parsed.input ? JSON.parse(parsed.input) : parsed;
        url = inner.url;
        params = inner.params || {};
      } catch {
        url = input.trim();
      }

      if (!url) return JSON.stringify({ error: "url is required" });

      const price = lookupPrice(url);
      if (price) {
        const budget = spendTracker.canSpend(price);
        if (!budget.allowed) {
          return JSON.stringify({
            error: `Budget exceeded: ${budget.reason}`,
            spendReport: spendTracker.getReport(),
          });
        }
      }

      const qs = new URLSearchParams(params).toString();
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
          settlement,
          timestamp: new Date().toISOString(),
        });

        return JSON.stringify({
          status,
          data: body,
          settlement,
          spendReport: spendTracker.getReport(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: msg });
      }
    },
  });
}
