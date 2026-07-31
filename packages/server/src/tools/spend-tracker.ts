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
  private hardCapMicro: number | null = null;
  private totalSpentMicro = 0;

  setHardCap(maxUsd: number): void {
    this.hardCapMicro = Math.round(maxUsd * 1_000_000);
  }

  getHardCapMicro(): number | null {
    return this.hardCapMicro;
  }

  getEffectiveCapMicro(): number | null {
    if (this.hardCapMicro === null && this.maxSpendMicro === null) return null;
    const caps = [this.hardCapMicro, this.maxSpendMicro].filter(
      (c): c is number => c !== null
    );
    return Math.min(...caps);
  }

  getRemainingMicro(): number {
    const cap = this.getEffectiveCapMicro();
    if (cap === null) return Infinity;
    return cap - this.totalSpentMicro;
  }

  canSpend(price: PriceString): { allowed: boolean; reason?: string } {
    const cap = this.getEffectiveCapMicro();
    if (cap === null) return { allowed: true };

    const cost = parsePriceToMicroUsdc(price);
    if (cost + this.totalSpentMicro > cap) {
      return {
        allowed: false,
        reason: `Spending ${price} would exceed your max spend of ${microUsdcToUsd(cap)} (${microUsdcToUsd(this.totalSpentMicro)} already spent, ${microUsdcToUsd(this.getRemainingMicro())} remaining)`,
      };
    }
    return { allowed: true };
  }

  setMaxSpend(maxUsd: number): string | null {
    const micro = Math.round(maxUsd * 1_000_000);
    if (this.hardCapMicro !== null && micro > this.hardCapMicro) {
      return `Cannot set max spend above the environment cap of ${microUsdcToUsd(this.hardCapMicro)}.`;
    }
    this.maxSpendMicro = micro;
    return null;
  }

  clearMaxSpend(): string | null {
    if (this.hardCapMicro !== null) {
      return `Cannot clear the max spend: the environment enforces a hard cap of ${microUsdcToUsd(this.hardCapMicro)}.`;
    }
    this.maxSpendMicro = null;
    return null;
  }

  getMaxSpendMicro(): number | null {
    return this.maxSpendMicro;
  }

  getTotalSpentMicro(): number {
    return this.totalSpentMicro;
  }

  recordSpend(price: PriceString): void {
    this.totalSpentMicro += parsePriceToMicroUsdc(price);
  }

  getReport(): string {
    const lines: string[] = [];
    if (this.hardCapMicro !== null) {
      lines.push(`Environment cap: ${microUsdcToUsd(this.hardCapMicro)}`);
    }
    if (this.maxSpendMicro === null) {
      lines.push(`Total spent: ${microUsdcToUsd(this.totalSpentMicro)} (no max spend set)`);
    } else {
      lines.push(`Max spend: ${microUsdcToUsd(this.maxSpendMicro)}`);
      lines.push(`Spent: ${microUsdcToUsd(this.totalSpentMicro)}`);
      lines.push(`Remaining: ${microUsdcToUsd(this.getRemainingMicro())}`);
    }
    return lines.join("\n");
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
      "Set a maximum total USDC spend limit for x402 payments. Once set, the Max Spend Policy blocks any purchase that would exceed the budget. Input JSON with 'amount' (number, USD). Omit amount or use 0 to clear the limit. If the environment enforces a MAX_SPEND_USDC cap, you cannot set or clear the limit above it.";
    this.parameters = setMaxSpendParams;
  }

  async normalizeParams(params: { amount?: number }): Promise<{ amount?: number }> {
    return params;
  }

  async coreAction(normalisedParams: { amount?: number }) {
    const amount = normalisedParams.amount;
    if (amount === undefined || amount === null || amount === 0) {
      const error = spendTracker.clearMaxSpend();
      if (error) {
        return { raw: { status: "error", error }, humanMessage: error };
      }
      const message = "Max spend limit cleared. No budget cap.";
      return { raw: { status: "ok", message }, humanMessage: message };
    }
    const error = spendTracker.setMaxSpend(amount);
    if (error) {
      return { raw: { status: "error", error }, humanMessage: error };
    }
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
