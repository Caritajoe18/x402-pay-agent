import { Router, type Router as RouterType } from "express";
import providersRoutes from "./providers.js";
import dataRoutes from "./data.js";
import auditRoutes from "./audit.js";
import chatRoutes from "./chat.js";

const router: RouterType = Router();

router.use(providersRoutes);
router.use(dataRoutes);
router.use(auditRoutes);
router.use(chatRoutes);

export default router;
