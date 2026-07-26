import { DynamicTool } from "@langchain/core/tools";
import { getFetchWithPayment } from "../x402-client.js";
import { logToHcs } from "../hedera.js";

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
        url = parsed.url;
        params = parsed.params || {};
      } catch {
        url = input.trim();
      }

      if (!url) return JSON.stringify({ error: "url is required" });

      const qs = new URLSearchParams(params).toString();
      const fullUrl = qs ? `${url}?${qs}` : url;

      try {
        const fetchWithPayment = getFetchWithPayment();
        const res = await fetchWithPayment(fullUrl);
        const status = res.status;
        const body = await res.json().catch(() => null);

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

        return JSON.stringify({ status, data: body, settlement });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: msg });
      }
    },
  });
}
