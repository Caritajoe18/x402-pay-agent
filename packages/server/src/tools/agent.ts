import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { config } from "../config.js";
import { listProviders } from "../providers/registry.js";
import { createHederaClient, createToolkit } from "./hedera.js";
import { createProviderTools } from "./provider-tools.js";
import { createX402MerchantTool } from "./x402-merchant-tool.js";

export function createAgent() {
  const client = createHederaClient();
  const toolkit = createToolkit(client);

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

  const hederaTools = toolkit.getTools();
  const providerTools = createProviderTools();
  const x402Tool = createX402MerchantTool();
  const dynamicTools = [...providerTools, x402Tool];
  const llmWithTools = llm.bindTools(dynamicTools);

  const providerList = listProviders()
    .map((p) => `- ${p.slug}: ${p.description} (${p.price}/call)`)
    .join("\n");

  const hederaToolList = hederaTools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const SYSTEM_PROMPT =
    `You are pay-agent, an autonomous AI agent built on the Hedera Agent Kit.\n` +
    `You function as an independent economic actor on the Hedera testnet.\n\n` +
    `## Core Capabilities\n` +
    `1. **Hedera Native**: Transfer HBAR, create/submit HCS topics, query accounts and tokens.\n` +
    `2. **Data Providers**: Use 'get_*' tools for market data, compliance, sentiment, and ESG data.\n` +
    `3. **Direct Merchant Interaction**: Use 'fetch_x402_merchant' to pay ANY x402-protected API autonomously.\n\n` +
    `## Available Hedera Tools\n${hederaToolList}\n\n` +
    `## Built-in Data Providers\n${providerList}\n\n` +
    `## x402 Merchant Ecosystem\n` +
    `You can access any x402-protected endpoint:\n` +
    `- AI & Inference: OpenAI Proxy ($0.005/req), Photo Gen APIs\n` +
    `- Financial: SaucerSwap (DEX), Stripe Proxy ($0.01 fee)\n` +
    `- Oracles: Pyth Network, Chainlink\n` +
    `- Compliance: Terminal 3 (T3N) identity, S3 Data Marketplace\n\n` +
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
    const toolCalls = response.tool_calls || [];
    const toolResults: Array<{
      tool: string;
      input: string;
      result: string;
    }> = [];

    for (const tc of toolCalls) {
      const tool = dynamicTools.find((t) => t.name === tc.name);
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
