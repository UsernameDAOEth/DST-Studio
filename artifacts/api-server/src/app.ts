import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedDefaults } from "./lib/dst/seed";
import { lazerStream } from "./lib/dst/lazerClient";
import { triggerScan } from "./lib/hermes/scan";
import { getConstraints } from "./lib/hermes/constraints";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

seedDefaults().catch((err) => logger.error({ err }, "Seed error"));
lazerStream.start().catch((err) => logger.error({ err }, "Lazer start error"));

// Auto-trigger a 15m-only scan when Lazer detects a significant intra-bar
// price move. The lazerClient already debounces per-asset; we add a
// per-asset in-flight guard so we never queue two move-driven scans for the
// same asset concurrently. Scheduled scans and the 4H pipeline are
// untouched.
const inFlightMoveScan = new Set<string>();
lazerStream.onSignificantMove((ev) => {
  const { asset, changeBps, fromPrice, toPrice } = ev;
  const known = new Set(getConstraints().preferredAssets);
  if (!known.has(asset)) return;
  if (inFlightMoveScan.has(asset)) {
    logger.info({ asset, changeBps }, "Lazer move-trigger skipped: scan already in flight");
    return;
  }
  inFlightMoveScan.add(asset);
  logger.info(
    { asset, changeBps: Number(changeBps.toFixed(1)), fromPrice, toPrice },
    "Lazer significant move — triggering 15m scan",
  );
  triggerScan([asset], { timeframes: ["15m"] })
    .catch((err) => logger.error({ err, asset }, "Lazer-triggered 15m scan failed"))
    .finally(() => inFlightMoveScan.delete(asset));
});

export default app;
