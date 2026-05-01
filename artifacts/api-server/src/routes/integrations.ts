import { Router } from "express";
import { getIntegrations, toggleIntegration } from "../lib/integrations/registry";

const router = Router();

router.get("/", (_, res) => {
  res.json(getIntegrations());
});

router.get("/:name", (req, res) => {
  const found = getIntegrations().find((i) => i.name === req.params.name);
  if (!found) { res.status(404).json({ error: "Integration not found" }); return; }
  res.json(found);
});

router.post("/:name/toggle", (req, res) => {
  const result = toggleIntegration(req.params.name);
  if (!result) { res.status(404).json({ error: "Integration not found" }); return; }
  res.json(result);
});

export default router;
