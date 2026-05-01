import { Router } from "express";
import { db, watchlistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AddToWatchlistBody, RemoveFromWatchlistParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(watchlistTable).orderBy(watchlistTable.addedAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      timeframe: r.timeframe,
      addedAt: r.addedAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const body = AddToWatchlistBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const [row] = await db
    .insert(watchlistTable)
    .values({ asset: body.data.asset.toUpperCase(), timeframe: body.data.timeframe ?? "4H" })
    .returning();
  res.status(201).json({ id: row.id, asset: row.asset, timeframe: row.timeframe, addedAt: row.addedAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const parsed = RemoveFromWatchlistParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(watchlistTable).where(eq(watchlistTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
