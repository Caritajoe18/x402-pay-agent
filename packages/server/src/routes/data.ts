import { Router, type Router as RouterType } from "express";
import { getProvider } from "../providers/registry.js";
import { logToHcs } from "../hedera.js";

const router: RouterType = Router();

router.get("/api/data/:provider", async (req, res) => {
  const slug = req.params.provider;
  const provider = getProvider(slug);

  if (!provider) {
    return res.status(404).json({
      error: `Provider "${slug}" not found`,
      available: ["weather", "market", "compliance"],
    });
  }

  try {
    const params: Record<string, string> = {};
    for (const p of provider.params) {
      const val = req.query[p.name];
      if (val && typeof val === "string") {
        params[p.name] = val;
      } else if (p.default) {
        params[p.name] = p.default;
      } else if (p.required) {
        return res.status(400).json({
          error: `Missing required parameter: ${p.name}`,
          description: p.description,
        });
      }
    }

    const data = await provider.fetch(params);
    const result = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;

    const hcs = await logToHcs({
      event: "x402_payment",
      provider: slug,
      endpoint: `/api/data/${slug}`,
      price: provider.price,
      params,
      timestamp: new Date().toISOString(),
    });

    res.json({
      ...result,
      _audit: {
        transactionId: hcs.transactionId,
        hashscanUrl: hcs.hashscanUrl,
        topicId: hcs.topicId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[provider:${slug}]`, msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
