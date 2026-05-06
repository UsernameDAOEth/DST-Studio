import { Router, type IRouter } from "express";
import { lazerStream } from "../lib/dst/lazerClient";

const router: IRouter = Router();

router.get("/snapshot", async (_req, res): Promise<void> => {
  res.json(lazerStream.snapshot());
});

export default router;
