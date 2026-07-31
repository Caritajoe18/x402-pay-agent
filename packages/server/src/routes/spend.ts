import { Router, type Router as RouterType } from "express";
import { spendTracker } from "../tools/spend-tracker.js";

const router: RouterType = Router();

router.get("/api/spend", (_req, res) => {
  const capMicro = spendTracker.getEffectiveCapMicro();
  const totalSpentMicro = spendTracker.getTotalSpentMicro();
  const remainingMicro = spendTracker.getRemainingMicro();

  res.json({
    limited: capMicro !== null,
    maxSpendUsd: capMicro === null ? null : capMicro / 1_000_000,
    hardCapUsd:
      spendTracker.getHardCapMicro() === null
        ? null
        : spendTracker.getHardCapMicro()! / 1_000_000,
    totalSpentUsd: totalSpentMicro / 1_000_000,
    remainingUsd: remainingMicro === Infinity ? null : remainingMicro / 1_000_000,
    report: spendTracker.getReport(),
  });
});

export default router;
