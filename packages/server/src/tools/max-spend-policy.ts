import {
  AbstractPolicy,
  type PostParamsNormalizationParams,
} from "@hashgraph/hedera-agent-kit";
import { spendTracker } from "./spend-tracker.js";
import { FETCH_X402_MERCHANT_TOOL, lookupPrice } from "./x402-merchant-tool.js";

/**
 * Policy that blocks x402 purchases that would exceed the configured max USDC spend.
 *
 * Registered in the agent's `context.hooks` and evaluated during the tool
 * lifecycle (post parameter normalization). When `shouldBlock...` returns
 * true, the AbstractPolicy base class throws, halting the tool before any
 * payment is made.
 */
export class MaxSpendPolicy extends AbstractPolicy {
  name = "Max Spend Policy";
  description = "Blocks x402 purchases that would exceed the configured max USDC spend";
  relevantTools = [FETCH_X402_MERCHANT_TOOL];

  protected shouldBlockPostParamsNormalization(
    params: PostParamsNormalizationParams
  ): boolean {
    const url = params.normalisedParams?.url;
    if (typeof url !== "string") return false;
    const price = lookupPrice(url);
    if (!price) return false;
    return !spendTracker.canSpend(price).allowed;
  }
}
