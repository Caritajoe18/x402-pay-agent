import { DynamicTool } from "@langchain/core/tools";
import { config } from "../config.js";
import { listProviders } from "../providers/registry.js";

export function createProviderTools() {
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
            params = {};
          }

          // Map 'input' key to first required param if needed
          if (params.input && !p.params.some((pp) => pp.name in params)) {
            const firstRequired = p.params.find((pp) => pp.required);
            if (firstRequired) {
              params[firstRequired.name] = params.input;
              delete params.input;
            }
          }

          const query = new URLSearchParams(params).toString();
          const resp = await fetch(
            `http://localhost:${config.port}/api/data/${p.slug}?${query}`
          );
          return JSON.stringify(await resp.json());
        },
      })
  );
}
