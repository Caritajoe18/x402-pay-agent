import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import { config } from "../config.js";
import { listProviders } from "../providers/registry.js";

const PORT = config.port;

export function createAgent() {
  const llm = new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    temperature: 0,
  });

  // Build tools dynamically from registered providers
  const providerMeta = listProviders();
  const tools = providerMeta.map(
    (p) =>
      new DynamicTool({
        name: `get_${p.slug}`,
        description: `${p.description}. Costs ${p.price} per call via x402 micropayment. Input: ${p.params.map((param) => `${param.name} (${param.description}${param.required ? "" : ", optional"})`).join(", ")}.`,
        func: async (input: string) => {
          // Parse input — support JSON or plain string (first param)
          let params: Record<string, string>;
          try {
            params = JSON.parse(input);
          } catch {
            // Treat as first required param value
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

  const llmWithTools = llm.bindTools(tools);

  const providerList = providerMeta
    .map((p) => `- ${p.slug}: ${p.description} (${p.price}/call)`)
    .join("\n");

  const SYSTEM_PROMPT =
    `You are pay-agent, an AI assistant that purchases real data using x402 micropayments on Hedera.\n\n` +
    `You have access to the following data providers:\n${providerList}\n\n` +
    `Each tool call costs a small amount of HBAR via x402. Use the tools when the user asks for real data.\n` +
    `Always explain what data you fetched and how much it cost.\n` +
    `If a tool fails, explain the error and suggest what the user could try.`;

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
