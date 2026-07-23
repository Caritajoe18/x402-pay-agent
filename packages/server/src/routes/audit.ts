import { Router, type Router as RouterType } from "express";
import { queryHcsMessages } from "../hedera.js";

const router: RouterType = Router();

router.get("/api/audit", async (_req, res) => {
  try {
    const { topicId, messages } = await queryHcsMessages();
    res.json({ topicId, messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
