import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import { config } from "../config.js";
import { listProviders } from "../providers/registry.js";
import { getFetchWithPayment } from "../x402-client.js";
import { logToHcs } from "../hedera.js";

const PORT = config.port;

export function createAgent() {
  const llm = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0,
  });

  const providerMeta = listProviders();

  const builtinTools = providerMeta.map(
    (p) =>
      new DynamicTool({
        name: `get_${p.slug}`,
        description: `${p.description}. Costs ${p.price} per call via x402 micropayment. Input: ${p.params.map((param) => `${param.name} (${param.description}${param.required ? "" : ", optional"})`).join(", ")}.`,
        func: async (input: string) => {
          let params: Record<string, string>;
          try {
            params = JSON.parse(input);
          } catch {
            const firstParam = p.params[0];
            params = { [firstParam.name]: input };
          }

          const query = new URLSearchParams(params).toString();
          const resp = await fetch(
            `http://localhost:${PORT}/api/data/${p.slug}?${query}`
          );
          return JSON.stringify(await resp.json());
        },
      })
  );

  const fetchMerchantTool = new DynamicTool({
    name: "fetch_merchant_data",
    description:
      "Fetch data from any x402-protected merchant endpoint. The agent autonomously handles the full x402 handshake: receives the 402 challenge, signs a Hedera TransferTransaction, settles via Blocky402 facilitator, and receives the data. Input: a JSON object with 'url' (the merchant endpoint) and optional 'params' (query parameters). Example: {\"url\": \"https://api.merchant.com/v1/data\", \"params\": {\"symbol\": \"AAPL\"}}",
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

        const settlement = res.headers.get("x-payment-response");
        let settlementInfo = null;
        if (settlement) {
          try {
            settlementInfo = JSON.parse(
              atob(settlement)
            );
          } catch { /* skip */ }
        }

        await logToHcs({
          event: "x402_merchant_purchase",
          url: fullUrl,
          status,
          settlement: settlementInfo,
          timestamp: new Date().toISOString(),
        });

        return JSON.stringify({
          status,
          data: body,
          settlement: settlementInfo,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: msg });
      }
    },
  });

  const tools = [...builtinTools, fetchMerchantTool];
  const llmWithTools = llm.bindTools(tools);

  const providerList = providerMeta
    .map((p) => `- ${p.slug}: ${p.description} (${p.price}/call)`)
    .join("\n");

  const SYSTEM_PROMPT =
    `You are pay-agent, an autonomous AI agent that purchases real data using x402 micropayments on Hedera.\n\n` +
    `## Core Capability\n` +
    `You are an independent economic actor. You can:\n` +
    "1. Use built-in data providers (tools prefixed with 'get_') for market data, compliance, sentiment, and ESG data.\n" +
    "2. Use 'fetch_merchant_data' to pay ANY x402-protected merchant endpoint autonomously. You handle the full x402 handshake — the merchant returns HTTP 402, you sign a Hedera transfer, Blocky402 settles it, and you receive the data.\n\n" +
    `## Built-in Providers\n${providerList}\n\n` +
    `## Direct Merchant Interaction\n` +
    `When a user asks for data not covered by built-in providers, use 'fetch_merchant_data' to interact with any x402-protected API. You can access:\n` +
    `- AI & Inference: OpenAI Proxy ($0.005/req), Photo Generation APIs\n` +
    `- Financial: SaucerSwap (DEX), Stripe Proxy ($0.01 fee), Memejob\n` +
    `- Oracles: Pyth Network, Chainlink\n` +
    `- Compliance: Terminal 3 (T3N) identity verification, S3 Data Marketplace\n\n` +
    `## Rules\n` +
    `- Every tool call costs HBAR via x402. Always explain what data you fetched and the cost.\n` +
    `- All transactions are logged to HCS for immutable audit trail.\n` +
    `- If a tool fails, explain the error and suggest alternatives.\n` +
    `- Be concise. Return structured data when possible.`;

  async function chat(
    userMessage: string
  ): Promise<{
    reply: string;
    toolCalls: Array<{ tool: string; input: string; result: unknown }>;
  }> {
    const messages: (SystemMessage | HumanMessage)[] = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ];

    const response = await llmWithTools.invoke(messages);
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

        messages.push(
          new HumanMessage(`Tool ${tc.name} result: ${result}`)
        );
      }
    }

    let finalReply: string;
    if (toolResults.length > 0) {
      const finalResponse = await llmWithTools.invoke(messages);
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

    return {
      reply: finalReply,
      toolCalls: toolResults.map((r) => ({
        tool: r.tool,
        input: r.input,
        result: JSON.parse(r.result),
      })),
    };
  }

  return { chat };
}
