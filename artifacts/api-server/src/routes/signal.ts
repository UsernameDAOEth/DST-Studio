import { Router, type Request, type Response } from "express";
import { computeTradingSignal } from "../lib/dst/tradingSignalEngine";

const router = Router();

function signalHandler(req: Request, res: Response) {
  res.status(200).json(computeTradingSignal(req.body ?? {}));
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
router.post("/audit", signalHandler);
router.all("/signal", methodNotAllowed);
router.all("/audit", methodNotAllowed);

export default router;
