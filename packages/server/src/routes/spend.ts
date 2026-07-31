import { Router, type Router as RouterType } from "express";
import { spendTracker } from "../tools/spend-tracker.js";

const router: RouterType = Router();

router.get("/api/spend", (_req, res) => {
  const maxSpendMicro = spendTracker.getMaxSpendMicro();
  const totalSpentMicro = spendTracker.getTotalSpentMicro();
  const remainingMicro = spendTracker.getRemainingMicro();

  res.json({
    limited: maxSpendMicro !== null,
    maxSpendUsd: maxSpendMicro === null ? null : maxSpendMicro / 1_000_000,
    totalSpentUsd: totalSpentMicro / 1_000_000,
    remainingUsd: remainingMicro === Infinity ? null : remainingMicro / 1_000_000,
    report: spendTracker.getReport(),
  });
});

export default router;
