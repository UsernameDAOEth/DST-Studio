import { pgTable, serial, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  asset: text("asset").notNull(),
  timeframe: text("timeframe").notNull().default("4H"),
  direction: text("direction").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  verdictDjzs: text("verdict_djzs").notNull(),
  entryZoneLow: numeric("entry_zone_low", { precision: 20, scale: 8 }),
  entryZoneHigh: numeric("entry_zone_high", { precision: 20, scale: 8 }),
  targetZone: numeric("target_zone", { precision: 20, scale: 8 }),
  invalidationPrice: numeric("invalidation_price", { precision: 20, scale: 8 }),
  reasonCodes: jsonb("reason_codes").notNull().$type<string[]>(),
  marketSnapshot: jsonb("market_snapshot").$type<Record<string, unknown>>(),
  trendRegime: jsonb("trend_regime").$type<Record<string, unknown>>(),
  openInterestContext: jsonb("open_interest_context").$type<Record<string, unknown>>(),
  auditReport: jsonb("audit_report").$type<Record<string, unknown>>(),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, computedAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
