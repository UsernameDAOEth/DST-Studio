import { Router, type Request, type Response } from "express";

type SignalRequest = {
  symbol?: unknown;
  venue?: unknown;
  timeframe?: unknown;
};

function cleanSignalField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function computeSafeDefaultSignal(input: SignalRequest) {
  return {
    ok: true,
    symbol: cleanSignalField(input.symbol),
    venue: cleanSignalField(input.venue),
    timeframe: cleanSignalField(input.timeframe),
    signal: "WAIT",
    confidence: 1,
    reasonCodes: ["SAFE_DEFAULT_NO_MARKET_FEATURES_CONNECTED"],
    timestamp: new Date().toISOString(),
    engine: "deterministic-signal-v0",
  };
}

const router = Router();

function signalHandler(req: Request, res: Response) {
  res.status(200).json(computeSafeDefaultSignal(req.body ?? {}));
}

router.post("/signal", signalHandler);
router.post("/audit", signalHandler);

export default router;
