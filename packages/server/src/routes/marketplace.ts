import { Router, type Router as RouterType } from "express";
import { dataCatalog } from "../marketplace/catalog.js";
import { logToHcs } from "../hedera.js";

const router: RouterType = Router();

// Public catalog — no payment required
router.get("/api/marketplace", (_req, res) => {
  const items = dataCatalog.map(({ id, name, description, price, category }) => ({
    id,
    name,
    description,
    price,
    category,
  }));
  res.json({ items, total: items.length });
});

// x402-protected data endpoints — payment required for each
for (const item of dataCatalog) {
  router.get(`/api/marketplace/${item.id}`, async (_req, res) => {
    try {
      const hcs = await logToHcs({
        event: "x402_data_purchase",
        itemId: item.id,
        itemName: item.name,
        price: item.price,
        timestamp: new Date().toISOString(),
      });

      res.json({
        ...(item.data as Record<string, unknown>),
        _meta: {
          itemId: item.id,
          price: item.price,
          settlement: {
            transactionId: hcs.transactionId,
            hashscanUrl: hcs.hashscanUrl,
            topicId: hcs.topicId,
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });
}

export default router;
