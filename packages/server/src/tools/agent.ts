import { Client, PrivateKey } from "@hiero-ledger/sdk";
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import { allCorePlugins } from "@hashgraph/hedera-agent-kit/plugins";
import { HcsAuditTrailHook } from "@hashgraph/hedera-agent-kit/hooks";
import { RejectToolPolicy } from "@hashgraph/hedera-agent-kit/policies";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import { config } from "../config.js";
import { listProviders } from "../providers/registry.js";
import { getFetchWithPayment } from "../x402-client.js";
import { logToHcs } from "../hedera.js";

const PORT = config.port;

function createHederaClient(): Client {
  const client = Client.forTestnet();
  const key = config.hedera.privateKey;
  const privateKey = key.startsWith("30")
    ? PrivateKey.fromStringDer(key)
    : PrivateKey.fromStringECDSA(key);
  client.setOperator(config.hedera.accountId, privateKey);
  return client;
}

function createToolkit(client: Client) {
  const auditHook = new HcsAuditTrailHook(
    ["fetch_x402_merchant", "submit_topic_message_tool"],
    config.hcs.topicId,
    client
  );

  const rejectPolicy = new RejectToolPolicy([
    "delete_account_tool",
    "delete_topic_tool",
  ]);

  return new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: allCorePlugins,
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: config.hedera.accountId,
        hooks: [auditHook, rejectPolicy],
      },
    },
  });
}

function createBuiltinProviderTools() {
  const providerMeta = listProviders();
  return providerMeta.map(
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
}

function createX402MerchantTool() {
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
  const builtinTools = createBuiltinProviderTools();
  const x402Tool = createX402MerchantTool();
  const allDynamicTools = [...builtinTools, x402Tool];
  const allTools = [...hederaTools, ...allDynamicTools];
  const llmWithTools = llm.bindTools(allDynamicTools);

  const providerMeta = listProviders();
  const providerList = providerMeta
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
    `- Every x402 payment costs HBAR. Always explain what data you fetched and the cost.\n` +
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
      const tool = allDynamicTools.find((t) => t.name === tc.name);
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
