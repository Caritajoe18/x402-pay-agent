import { z } from "zod";
import { BaseTool } from "@hashgraph/hedera-agent-kit";

type PriceString = string;

function parsePriceToMicroUsdc(price: PriceString): number {
  const cleaned = price.replace(/^\$/, "").trim();
  const dollars = parseFloat(cleaned);
  return Math.round(dollars * 1_000_000);
}

function microUsdcToUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(micro >= 1000 ? 3 : 6)}`;
}

class SpendTracker {
  private maxSpendMicro: number | null = null;
  private totalSpentMicro = 0;

  setMaxSpend(maxUsd: number): void {
    this.maxSpendMicro = Math.round(maxUsd * 1_000_000);
  }

  clearMaxSpend(): void {
    this.maxSpendMicro = null;
  }

  getMaxSpendMicro(): number | null {
    return this.maxSpendMicro;
  }

  getTotalSpentMicro(): number {
    return this.totalSpentMicro;
  }

  getRemainingMicro(): number {
    if (this.maxSpendMicro === null) return Infinity;
    return this.maxSpendMicro - this.totalSpentMicro;
  }

  canSpend(price: PriceString): { allowed: boolean; reason?: string } {
    if (this.maxSpendMicro === null) return { allowed: true };

    const cost = parsePriceToMicroUsdc(price);
    if (cost + this.totalSpentMicro > this.maxSpendMicro) {
      return {
        allowed: false,
        reason: `Spending ${price} would exceed your max spend of ${microUsdcToUsd(this.maxSpendMicro)} (${microUsdcToUsd(this.totalSpentMicro)} already spent, ${microUsdcToUsd(this.getRemainingMicro())} remaining)`,
      };
    }
    return { allowed: true };
  }

  recordSpend(price: PriceString): void {
    this.totalSpentMicro += parsePriceToMicroUsdc(price);
  }

  getReport(): string {
    if (this.maxSpendMicro === null) {
      return `Total spent: ${microUsdcToUsd(this.totalSpentMicro)} (no max spend set)`;
    }
    return [
      `Max spend: ${microUsdcToUsd(this.maxSpendMicro)}`,
      `Spent: ${microUsdcToUsd(this.totalSpentMicro)}`,
      `Remaining: ${microUsdcToUsd(this.getRemainingMicro())}`,
    ].join("\n");
  }
}

export const spendTracker = new SpendTracker();

const setMaxSpendParams = z.object({
  amount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Max total USDC spend in USD (e.g. 0.05 = 5 cents). Omit or use 0 to clear the limit."),
});

class SetMaxSpendTool extends BaseTool {
  method = "set_max_spend";
  name = "Set Max Spend";
  description: string;
  parameters: any;

  constructor() {
    super();
    this.description =
      "Set a maximum total USDC spend limit for x402 payments. Once set, the Max Spend Policy blocks any purchase that would exceed the budget. Input JSON with 'amount' (number, USD). Omit amount or use 0 to clear the limit.";
    this.parameters = setMaxSpendParams;
  }

  async normalizeParams(params: { amount?: number }): Promise<{ amount?: number }> {
    return params;
  }

  async coreAction(normalisedParams: { amount?: number }) {
    const amount = normalisedParams.amount;
    if (amount === undefined || amount === null || amount === 0) {
      spendTracker.setMaxSpend(0);
      spendTracker.clearMaxSpend();
      const message = "Max spend limit cleared. No budget cap.";
      return { raw: { status: "ok", message }, humanMessage: message };
    }
    spendTracker.setMaxSpend(amount);
    const message = `Max spend set to $${amount.toFixed(amount >= 1 ? 2 : 4)}`;
    return { raw: { status: "ok", maxSpend: message, message }, humanMessage: message };
  }

  async shouldSecondaryAction(): Promise<boolean> {
    return false;
  }

  async secondaryAction(request: unknown) {
    return request;
  }
}

class GetSpendReportTool extends BaseTool {
  method = "get_spend_report";
  name = "Get Spend Report";
  description: string;
  parameters: any;

  constructor() {
    super();
    this.description =
      "Show the current spend report: max budget, total spent, and remaining balance for x402 payments.";
    this.parameters = z.object({});
  }

  async normalizeParams(params: unknown): Promise<unknown> {
    return params;
  }

  async coreAction() {
    const report = spendTracker.getReport();
    return { raw: { report }, humanMessage: report };
  }

  async shouldSecondaryAction(): Promise<boolean> {
    return false;
  }

  async secondaryAction(request: unknown) {
    return request;
  }
}

export { SetMaxSpendTool, GetSpendReportTool, parsePriceToMicroUsdc, microUsdcToUsd };
