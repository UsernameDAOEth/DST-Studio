import { Router } from "express";
import { AgentChatBody } from "@workspace/api-zod";
import { interpretCommand } from "../lib/dst/agentInterpreter";
import { randomUUID } from "crypto";

const router = Router();

router.post("/chat", async (req, res) => {
  const body = AgentChatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const sessionId = body.data.sessionId ?? randomUUID();
  const response = await interpretCommand(body.data.message, sessionId);
  res.json(response);
});

export default router;
