import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { config } from "./config.js";
import { buildX402Routes } from "./providers/registry.js";

export function createX402Middleware() {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: config.facilitator.url,
  });

  const hederaScheme = new ExactHederaScheme();
  const routes = buildX402Routes(config.hedera.accountId);

  return paymentMiddlewareFromConfig(
    routes,
    [facilitatorClient],
    [{ network: "hedera:testnet", server: hederaScheme }],
    { appName: "pay-agent", testnet: true }
  );
}
