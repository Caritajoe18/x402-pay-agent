import { Router, type Router as RouterType } from "express";
import { queryHcsMessages } from "../hedera.js";

const router: RouterType = Router();

let cached: { topicId: string; messages: Record<string, unknown>[] } | null =
  null;
let lastFetch = 0;
const CACHE_TTL_MS = 10_000;

router.get("/api/audit", async (_req, res) => {
  try {
    const now = Date.now();
    if (!cached || now - lastFetch > CACHE_TTL_MS) {
      cached = await queryHcsMessages();
      lastFetch = now;
    }
    res.json(cached);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
