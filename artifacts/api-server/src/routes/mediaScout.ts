import { Router } from "express";
import { runMediaScoutDryRun } from "../lib/mediaScout/dryRun";
import { YouTubeDiscoveryError } from "../lib/mediaScout/youtubeDiscovery";

const router = Router();

router.get("/discover", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
  try {
    res.json(await runMediaScoutDryRun(query, Number.isFinite(limit) ? limit : 10));
  } catch (err) {
    if (err instanceof YouTubeDiscoveryError) {
      const status = err.code === "MISSING_YOUTUBE_API_KEY" ? 400 : err.code === "NO_YOUTUBE_RESULTS" ? 404 : 502;
      res.status(status).json({
        mode: "dry_run",
        error: err.code,
        message: err.message,
      });
      return;
    }
    throw err;
  }
});

export default router;
