import { db, watchlistTable, alertsTable } from "@workspace/db";
import { logger } from "../logger";

export async function seedDefaults() {
  try {
    const existing = await db.select().from(watchlistTable);
    if (existing.length === 0) {
      await db.insert(watchlistTable).values([
        { asset: "ETH", timeframe: "4H" },
        { asset: "BTC", timeframe: "4H" },
        { asset: "SOL", timeframe: "4H" },
      ]);
      logger.info("Seeded default watchlist entries");
    }

    const existingAlerts = await db.select().from(alertsTable);
    if (existingAlerts.length === 0) {
      await db.insert(alertsTable).values([
        { asset: "ETH", condition: "DJZS_PASS" },
        { asset: "BTC", condition: "LONG_SIGNAL" },
      ]);
      logger.info("Seeded default alerts");
    }
  } catch (err) {
    logger.warn({ err }, "Seed failed (non-fatal)");
  }
}
