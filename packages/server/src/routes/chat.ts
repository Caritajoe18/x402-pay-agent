import { Router, type Router as RouterType } from "express";
import { createAgent } from "../tools/agent.js";

const router: RouterType = Router();
const agent = createAgent();

router.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const result = await agent.chat(message);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat]", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
