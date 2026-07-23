import { Router, type Router as RouterType } from "express";
import { listProviders } from "../providers/registry.js";

const router: RouterType = Router();

router.get("/api/providers", (_req, res) => {
  res.json({ providers: listProviders() });
});

export default router;
