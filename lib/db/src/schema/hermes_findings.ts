import { pgTable, serial, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hermesFindingsTable = pgTable("hermes_findings", {
  id: serial("id").primaryKey(),
  findingId: text("finding_id").notNull().unique(),
  runId: text("run_id"),
  sourceAgent: text("source_agent").notNull(),
  marketType: text("market_type").notNull().default("PERP"),
  target: text("target").notNull(),
  observationType: text("observation_type").notNull(),
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").notNull().$type<Record<string, unknown>[]>().default([]),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull().default("0"),
  suggestedFlags: jsonb("suggested_flags").notNull().$type<string[]>().default([]),
  status: text("status").notNull().default("ACTIVE"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHermesFindingSchema = createInsertSchema(hermesFindingsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertHermesFinding = z.infer<typeof insertHermesFindingSchema>;
export type HermesFinding = typeof hermesFindingsTable.$inferSelect;
