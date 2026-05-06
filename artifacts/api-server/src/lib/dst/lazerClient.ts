import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import {
  DEFAULT_STREAM_SERVICE_0_URL,
  DEFAULT_STREAM_SERVICE_1_URL,
} from "@pythnetwork/pyth-lazer-sdk/constants";
import type { JsonOrBinaryResponse } from "@pythnetwork/pyth-lazer-sdk/client";
import { logger } from "../logger";

export type LazerStatus =
  | "UNCONFIGURED"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR";

export interface LazerFeedTick {
  asset: string;
  priceFeedId: number;
  price: number | null;
  confidence: number | null;
  exponent: number | null;
  publishTimeMs: number | null;
  ageMs: number | null;
  receivedAt: number;
}

interface FeedConfig {
  asset: string;
  priceFeedId: number;
}

const FEEDS: FeedConfig[] = [
  { asset: "BTC", priceFeedId: 1 },
  { asset: "ETH", priceFeedId: 2 },
  { asset: "SOL", priceFeedId: 6 },
];

const FEED_BY_ID = new Map<number, FeedConfig>(FEEDS.map((f) => [f.priceFeedId, f]));

const SUBSCRIPTION_ID = 1;

class LazerStreamManager {
  private status: LazerStatus = "UNCONFIGURED";
  private client: PythLazerClient | null = null;
  private latest = new Map<string, LazerFeedTick>();
  private lastError: string | null = null;
  private lastConnectedAt: number | null = null;
  private startedAt: number | null = null;
  private starting: Promise<void> | null = null;

  async start(): Promise<void> {
    const token = process.env.PYTH_LAZER_API_KEY;
    if (!token) {
      this.status = "UNCONFIGURED";
      logger.info("Pyth Lazer not configured — PYTH_LAZER_API_KEY missing");
      return;
    }
    if (this.client || this.starting) return;

    this.starting = (async () => {
      this.status = "CONNECTING";
      this.startedAt = Date.now();
      try {
        const client = await PythLazerClient.create({
          token,
          webSocketPoolConfig: {
            urls: [DEFAULT_STREAM_SERVICE_0_URL, DEFAULT_STREAM_SERVICE_1_URL],
            numConnections: 2,
          },
        });
        this.client = client;
        this.status = "CONNECTED";
        this.lastConnectedAt = Date.now();
        this.lastError = null;

        client.addMessageListener((msg) => this.onMessage(msg));
        client.addAllConnectionsDownListener(() => {
          this.status = "DISCONNECTED";
          logger.warn("Pyth Lazer: all connections down");
        });
        client.addConnectionRestoredListener(() => {
          this.status = "CONNECTED";
          this.lastConnectedAt = Date.now();
          logger.info("Pyth Lazer: connection restored");
        });

        client.subscribe({
          type: "subscribe",
          subscriptionId: SUBSCRIPTION_ID,
          priceFeedIds: FEEDS.map((f) => f.priceFeedId),
          properties: ["price", "confidence", "exponent"],
          formats: [],
          parsed: true,
          channel: "fixed_rate@200ms",
        });

        logger.info(
          { feeds: FEEDS.map((f) => f.asset) },
          "Pyth Lazer connected and subscribed",
        );
      } catch (err) {
        this.status = "ERROR";
        this.lastError = err instanceof Error ? err.message : String(err);
        logger.error({ err }, "Pyth Lazer: failed to start");
      } finally {
        this.starting = null;
      }
    })();

    return this.starting;
  }

  private onMessage(event: JsonOrBinaryResponse): void {
    if (event.type === "json") {
      const v = event.value;
      if (v.type === "subscriptionError" || v.type === "error") {
        this.lastError = v.error;
        logger.warn({ err: v.error }, "Pyth Lazer: subscription error");
      }
      return;
    }
    const parsed = event.value.parsed;
    if (!parsed) return;
    const ts = Number(parsed.timestampUs) / 1000;
    for (const f of parsed.priceFeeds) {
      const cfg = FEED_BY_ID.get(f.priceFeedId);
      if (!cfg) continue;
      const exponent = typeof f.exponent === "number" ? f.exponent : -8;
      const rawPrice = f.price;
      const rawConf = f.confidence;
      const price = rawPrice != null ? Number(rawPrice) * Math.pow(10, exponent) : null;
      const confidence = rawConf != null ? rawConf * Math.pow(10, exponent) : null;
      const now = Date.now();
      this.latest.set(cfg.asset, {
        asset: cfg.asset,
        priceFeedId: cfg.priceFeedId,
        price,
        confidence,
        exponent,
        publishTimeMs: ts,
        ageMs: now - ts,
        receivedAt: now,
      });
    }
  }

  snapshot() {
    const now = Date.now();
    const feeds = FEEDS.map((cfg) => {
      const tick = this.latest.get(cfg.asset);
      if (!tick) {
        return {
          asset: cfg.asset,
          priceFeedId: cfg.priceFeedId,
          price: null,
          confidence: null,
          exponent: null,
          publishTimeMs: null,
          ageMs: null,
          receivedAt: null,
        };
      }
      return {
        ...tick,
        ageMs: tick.publishTimeMs != null ? now - tick.publishTimeMs : null,
      };
    });
    return {
      status: this.status,
      lastError: this.lastError,
      lastConnectedAt: this.lastConnectedAt,
      startedAt: this.startedAt,
      feeds,
    };
  }
}

export const lazerStream = new LazerStreamManager();
