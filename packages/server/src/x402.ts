import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { config } from "./config.js";
import { buildX402Routes } from "./providers/registry.js";

export function createX402Middleware() {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: config.facilitator.url,
  });

  const server = new x402ResourceServer(facilitatorClient).register(
    "hedera:*",
    new ExactHederaScheme()
  );

  const routes = buildX402Routes(config.hedera.accountId);

  return paymentMiddleware(routes, server, {
    appName: "pay-agent",
    testnet: true,
  });
}
