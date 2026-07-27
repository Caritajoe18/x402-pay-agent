import { Router, type Router as RouterType } from "express";
import { createAgent } from "../tools/agent.js";

const router: RouterType = Router();
let agent: ReturnType<typeof createAgent> | null = null;

router.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    if (!agent) agent = createAgent();
    const result = await agent.chat(message);
    res.json(result);
  } catch (err: unknown) {
    console.error("[chat] Error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
