import { Router } from "express";
import { db, alertsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateAlertBody, DeleteAlertParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(alertsTable).orderBy(alertsTable.createdAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      condition: r.condition,
      threshold: r.threshold ? Number(r.threshold) : undefined,
      active: r.active,
      triggeredAt: r.triggeredAt?.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const body = CreateAlertBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const [row] = await db
    .insert(alertsTable)
    .values({
      asset: body.data.asset.toUpperCase(),
      condition: body.data.condition,
      threshold: body.data.threshold ? String(body.data.threshold) : undefined,
    })
    .returning();
  res.status(201).json({
    id: row.id,
    asset: row.asset,
    condition: row.condition,
    threshold: row.threshold ? Number(row.threshold) : undefined,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const parsed = DeleteAlertParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(alertsTable).where(eq(alertsTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
