import { DynamicTool } from "@langchain/core/tools";

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

export function createBudgetTools(): DynamicTool[] {
  return [
    new DynamicTool({
      name: "set_max_spend",
      description:
        "Set a maximum total USDC spend limit for x402 payments. Once set, the agent will refuse any purchase that would exceed this budget. Input: JSON with 'amount' (number, in USD e.g. 0.05 for 5 cents). Use 0 or omit to clear the limit.",
      func: async (input: string) => {
        try {
          const parsed = JSON.parse(input);
          const inner = parsed.input ? JSON.parse(parsed.input) : parsed;
          const amount = inner.amount;
          if (amount === undefined || amount === null || amount === 0) {
            spendTracker.setMaxSpend(0);
            spendTracker.clearMaxSpend();
            return JSON.stringify({ status: "ok", message: "Max spend limit cleared. No budget cap." });
          }
          if (typeof amount !== "number" || amount < 0) {
            return JSON.stringify({ error: "amount must be a positive number" });
          }
          spendTracker.setMaxSpend(amount);
          return JSON.stringify({
            status: "ok",
            maxSpend: `$${amount.toFixed(amount >= 1 ? 2 : 4)}`,
            message: `Max spend set to $${amount.toFixed(amount >= 1 ? 2 : 4)}`,
          });
        } catch {
          return JSON.stringify({ error: "Invalid input. Use JSON with 'amount' field." });
        }
      },
    }),
    new DynamicTool({
      name: "get_spend_report",
      description:
        "Show the current spend report: max budget, total spent, and remaining balance for x402 payments.",
      func: async () => {
        return JSON.stringify({ report: spendTracker.getReport() });
      },
    }),
  ];
}

export { parsePriceToMicroUsdc, microUsdcToUsd };
