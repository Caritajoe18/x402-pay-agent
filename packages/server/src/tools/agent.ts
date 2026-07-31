import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import { config } from "../config.js";
import { listProviders } from "../providers/registry.js";
import { createHederaClient, createToolkit } from "./hedera.js";
import { createProviderTools } from "./provider-tools.js";
import { spendTracker } from "./spend-tracker.js";

export function createAgent() {
  const client = createHederaClient();
  const toolkit = createToolkit(client);

  if (config.maxSpendUsdc !== null && config.maxSpendUsdc > 0) {
    spendTracker.setMaxSpend(config.maxSpendUsdc);
    console.log(`[agent] Max spend set from env: $${config.maxSpendUsdc}`);
  }

  const ollamaHeaders: Record<string, string> = {};
  if (config.ollama.apiKey) {
    ollamaHeaders["Authorization"] = `Bearer ${config.ollama.apiKey}`;
  }

  const llm = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0,
    headers: ollamaHeaders,
  });

  const providerTools = createProviderTools();
  const allTools = [...toolkit.getTools(), ...providerTools];
  console.log("[agent] All tools:", allTools.map((t) => t.name));
  const llmWithTools = llm.bindTools(allTools);

  const providerList = listProviders()
    .map((p) => `- ${p.slug}: ${p.description} (${p.price}/call)`)
    .join("\n");

  const hederaToolList = toolkit
    .getTools()
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const SYSTEM_PROMPT =
    `You are pay-agent, an autonomous AI agent built on the Hedera Agent Kit.\n` +
    `You function as an independent economic actor on the Hedera testnet.\n\n` +
    `## Core Capabilities\n` +
    `1. **Hedera Native**: Transfer HBAR, create/submit HCS topics, query accounts and tokens.\n` +
    `2. **Pay-per-Query (Ref Arch 1)**: Use 'fetch_x402_merchant' to buy live provider data per call — pay USDC per query via x402 and settle on Hedera.\n` +
    `3. **Data Marketplace (Ref Arch 2)**: Use 'fetch_x402_merchant' to buy premium datasets from the x402 pay-to-read marketplace.\n` +
    `4. **External Merchants**: Use 'fetch_x402_merchant' with a URL the user provides.\n` +
    `5. **Free Providers**: Use 'get_*' tools for free data (no x402 payment required).\n\n` +
    `## Available Hedera Tools\n${hederaToolList}\n\n` +
    `## x402 Pay-per-Query Data Providers (Ref Arch 1)\n` +
    `These endpoints are x402-protected on this server. Use 'fetch_x402_merchant' to pay per query.\n` +
    `Each call costs USDC. No subscription — you only pay for what you read.\n` +
    `- Market Prices: ${config.publicUrl}/api/data/market\n` +
    `- Sentiment Analysis: ${config.publicUrl}/api/data/sentiment\n` +
    `- Compliance Check: ${config.publicUrl}/api/data/compliance\n` +
    `- ESG Scores: ${config.publicUrl}/api/data/esg\n` +
    `- Weather: ${config.publicUrl}/api/data/weather\n\n` +
    `## x402 Data Marketplace (Ref Arch 2 — PREMIUM DATASETS)\n` +
    `Use 'fetch_x402_merchant' to purchase access to curated premium datasets.\n` +
    `- BTC On-Chain: ${config.publicUrl}/api/marketplace/btc-onchain ($0.001)\n` +
    `- ETH Gas: ${config.publicUrl}/api/marketplace/eth-gas ($0.001)\n` +
    `- Macro Indicators: ${config.publicUrl}/api/marketplace/macro-indicators ($0.005)\n` +
    `- DeFi TVL: ${config.publicUrl}/api/marketplace/defi-tvl ($0.003)\n` +
    `- Fear & Greed: ${config.publicUrl}/api/marketplace/sentiment-composite ($0.002)\n\n` +
    `## Free Built-in Data Providers\n${providerList}\n\n` +
    `## IMPORTANT SCENARIOS\n` +
    `- Ref Arch 1 (Agent pays per query): User asks about portfolio management, market data, prices, weather. Use 'fetch_x402_merchant' with /api/data/* URLs to pay per query.\n` +
    `- Ref Arch 2 (Data marketplace): User asks for premium/on-chain data. Use 'fetch_x402_merchant' with /api/marketplace/* URLs.\n` +
    `- Free data: User wants free data without spending USDC. Use 'get_*' tools.\n` +
    `- External: User provides their own x402 URL. Use 'fetch_x402_merchant'.\n\n` +
    `## BUDGET & SPEND POLICY\n` +
    `A Max Spend Policy (Hedera Agent Kit policy) enforces a maximum USDC budget on all x402 payments. When the user sets a budget, the policy blocks any purchase that would exceed it BEFORE any payment is signed.\n` +
    `- 'set_max_spend' — set a max total spend in USD (e.g. 0.05 = 5 cents). The policy will then block purchases exceeding it.\n` +
    `- 'get_spend_report' — show current spend, remaining budget, and max limit.\n` +
    `- If no max is set, there is no spend limit.\n` +
    `- Every x402 call returns a 'spendReport' in the result. Always check it when the user asks about budget.\n` +
    `- If a purchase is blocked by the policy, explain why and suggest using 'set_max_spend' to raise the limit (with user approval).\n\n` +
    `## IMPORTANT TOOL USAGE RULES\n` +
    `- For pay-per-query (Ref Arch 1): use 'fetch_x402_merchant' with a /api/data/* URL.\n` +
    `- For premium marketplace data (Ref Arch 2): use 'fetch_x402_merchant' with a /api/marketplace/* URL.\n` +
    `- For free data: use 'get_*' tools (market, sentiment, compliance, esg, weather).\n` +
    `- For external x402 APIs: use 'fetch_x402_merchant' with the URL the user provides.\n` +
    `- NEVER make up URLs. Only use URLs listed above or provided by the user.\n\n` +
    `## Rules\n` +
    `- Every x402 payment costs USDC. Always explain what data you fetched and the cost.\n` +
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
    console.log("[agent] LLM response:", JSON.stringify({
      content: response.content,
      tool_calls: response.tool_calls,
    }));
    const toolCalls = response.tool_calls || [];
    const toolResults: Array<{
      tool: string;
      input: string;
      result: string;
    }> = [];

    for (const tc of toolCalls) {
      const tool = allTools.find((t) => t.name === tc.name);
      if (tool) {
        const input =
          typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args);
        console.log("[agent] Executing tool:", tc.name, "input:", input);
        // DynamicTool expects string, Hedera tools expect object
        const toolInput =
          tool instanceof DynamicTool
            ? input
            : typeof tc.args === "string"
              ? JSON.parse(tc.args)
              : tc.args;
        const result = await (tool as unknown as { invoke: (input: unknown) => Promise<string> }).invoke(toolInput);
        console.log("[agent] Tool result:", result);
        toolResults.push({ tool: tc.name, input, result });

        messages.push(
          new HumanMessage(`Tool ${tc.name} result: ${result}`)
        );
      } else {
        console.log("[agent] Tool not found:", tc.name);
      }
    }

    let finalReply: string;
    if (toolResults.length > 0) {
      try {
        const finalResponse = await llmWithTools.invoke(messages);
        console.log("[agent] Final LLM response:", JSON.stringify({
          content: finalResponse.content,
          tool_calls: finalResponse.tool_calls,
        }));
        finalReply =
          typeof finalResponse.content === "string"
            ? finalResponse.content
            : JSON.stringify(finalResponse.content);
      } catch (err) {
        console.error("[agent] Final LLM call failed:", err);
        finalReply = toolResults
          .map((r) => `${r.tool}: ${r.result}`)
          .join("\n\n");
      }
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
