import { Router, type IRouter } from "express";
import healthRouter from "./health";
import signalsRouter from "./signals";
import marketRouter from "./market";
import auditRouter from "./audit";
import watchlistRouter from "./watchlist";
import alertsRouter from "./alerts";
import agentRouter from "./agent";
import integrationsRouter from "./integrations";
import hermesRouter from "./hermes";
import pythRouter from "./pyth";
import lazerRouter from "./lazer";
import dstRouter from "./dst";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/signals", signalsRouter);
router.use("/market", marketRouter);
router.use("/audit", auditRouter);
router.use("/watchlist", watchlistRouter);
router.use("/alerts", alertsRouter);
router.use("/agent", agentRouter);
router.use("/integrations", integrationsRouter);
router.use("/hermes", hermesRouter);
router.use("/pyth", pythRouter);
router.use("/lazer", lazerRouter);
router.use("/dst", dstRouter);

export default router;
