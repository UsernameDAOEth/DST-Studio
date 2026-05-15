import { Router, type Request, type Response } from "express";
import { computeAgentAudit } from "../lib/dst/agentAuditEngine";
import { computeTradingSignal } from "../lib/dst/tradingSignalEngine";

const router = Router();

function signalHandler(req: Request, res: Response) {
  res.status(200).json(computeTradingSignal(req.body ?? {}));
}

function auditHandler(req: Request, res: Response) {
  res.status(200).json(computeAgentAudit(req.body ?? {}));
}

function methodNotAllowed(_req: Request, res: Response) {
  res.status(405).json({
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    allowedMethods: ["POST"],
    timestamp: new Date().toISOString(),
  });
}

router.post("/signal", signalHandler);
router.post("/audit", auditHandler);
router.all("/signal", methodNotAllowed);
router.all("/audit", methodNotAllowed);

export default router;
