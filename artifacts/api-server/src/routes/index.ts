import { Router, type IRouter } from "express";
import healthRouter from "./health";
import signalsRouter from "./signals";
import marketRouter from "./market";
import auditRouter from "./audit";
import watchlistRouter from "./watchlist";
import alertsRouter from "./alerts";
import agentRouter from "./agent";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/signals", signalsRouter);
router.use("/market", marketRouter);
router.use("/audit", auditRouter);
router.use("/watchlist", watchlistRouter);
router.use("/alerts", alertsRouter);
router.use("/agent", agentRouter);

export default router;
