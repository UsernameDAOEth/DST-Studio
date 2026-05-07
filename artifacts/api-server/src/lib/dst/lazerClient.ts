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

export interface SignificantMoveEvent {
  asset: string;
  fromPrice: number;
  toPrice: number;
  changeBps: number;
  detectedAt: number;
}

export type SignificantMoveListener = (ev: SignificantMoveEvent) => void;

interface MoveBaseline {
  price: number;
  setAt: number;
}

const FEEDS: FeedConfig[] = [
  { asset: "BTC", priceFeedId: 1 },
  { asset: "ETH", priceFeedId: 2 },
  { asset: "SOL", priceFeedId: 6 },
];

const FEED_BY_ID = new Map<number, FeedConfig>(FEEDS.map((f) => [f.priceFeedId, f]));

const SUBSCRIPTION_ID = 1;

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

class LazerStreamManager {
  private status: LazerStatus = "UNCONFIGURED";
  private client: PythLazerClient | null = null;
  private latest = new Map<string, LazerFeedTick>();
  private lastError: string | null = null;
  private lastConnectedAt: number | null = null;
  private startedAt: number | null = null;
  private starting: Promise<void> | null = null;
  private moveListeners = new Set<SignificantMoveListener>();
  private moveBaselines = new Map<string, MoveBaseline>();
  private lastMoveFiredAt = new Map<string, number>();
  private moveThresholdBps = readEnvNumber("LAZER_MOVE_TRIGGER_BPS", 50);
  private moveDebounceMs = readEnvNumber("LAZER_MOVE_DEBOUNCE_MS", 60_000);
  private moveBaselineMaxAgeMs = readEnvNumber("LAZER_MOVE_BASELINE_MAX_AGE_MS", 15 * 60_000);

  onSignificantMove(listener: SignificantMoveListener): () => void {
    this.moveListeners.add(listener);
    return () => this.moveListeners.delete(listener);
  }

  private maybeEmitMove(asset: string, price: number, now: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    const baseline = this.moveBaselines.get(asset);
    if (!baseline || now - baseline.setAt > this.moveBaselineMaxAgeMs) {
      this.moveBaselines.set(asset, { price, setAt: now });
      return;
    }
    const changeBps = ((price - baseline.price) / baseline.price) * 10_000;
    if (Math.abs(changeBps) < this.moveThresholdBps) return;

    const lastFired = this.lastMoveFiredAt.get(asset) ?? 0;
    if (now - lastFired < this.moveDebounceMs) {
      // Still update the baseline so we measure the next move from here, but
      // don't fire — we're in the cool-down window.
      this.moveBaselines.set(asset, { price, setAt: now });
      return;
    }

    const ev: SignificantMoveEvent = {
      asset,
      fromPrice: baseline.price,
      toPrice: price,
      changeBps,
      detectedAt: now,
    };
    this.lastMoveFiredAt.set(asset, now);
    this.moveBaselines.set(asset, { price, setAt: now });
    for (const listener of this.moveListeners) {
      try {
        listener(ev);
      } catch (err) {
        logger.error({ err, asset }, "Pyth Lazer: significant-move listener error");
      }
    }
  }

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
        const sdkLogger = {
          trace: () => {},
          debug: () => {},
          info: (msg: unknown) => logger.info(`[lazer-sdk] ${String(msg)}`),
          warn: (msg: unknown) => logger.warn(`[lazer-sdk] ${String(msg)}`),
          error: (msg: unknown) => logger.error(`[lazer-sdk] ${String(msg)}`),
        };
        const client = await PythLazerClient.create({
          token,
          logger: sdkLogger,
          webSocketPoolConfig: {
            urls: [DEFAULT_STREAM_SERVICE_0_URL, DEFAULT_STREAM_SERVICE_1_URL],
            numConnections: 2,
            onWebSocketPoolError: (err: Error) => {
              this.lastError = err.message;
              logger.error({ err }, "Pyth Lazer: pool error");
            },
            onWebSocketError: (err: Error) => {
              logger.warn({ err: err.message }, "Pyth Lazer: socket error");
            },
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
          formats: ["evm"],
          deliveryFormat: "json",
          parsed: true,
          channel: "fixed_rate@1000ms",
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

  private firstMessageLogged = false;

  private onMessage(event: JsonOrBinaryResponse): void {
    if (!this.firstMessageLogged) {
      this.firstMessageLogged = true;
      logger.info({ type: event.type }, "Pyth Lazer: first message received");
    }
    let parsed: { timestampUs: string; priceFeeds: Array<{ priceFeedId: number; price?: string; confidence?: number; exponent?: number }> } | undefined;
    if (event.type === "json") {
      const v = event.value;
      if (v.type === "subscriptionError" || v.type === "error") {
        this.lastError = v.error;
        logger.warn({ err: v.error }, "Pyth Lazer: subscription error");
        return;
      }
      if (v.type === "streamUpdated") {
        parsed = v.parsed;
      } else {
        return;
      }
    } else {
      parsed = event.value.parsed;
    }
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
      if (price != null) this.maybeEmitMove(cfg.asset, price, now);
    }
  }

  getLatest(asset: string): LazerFeedTick | null {
    const tick = this.latest.get(asset);
    if (!tick) return null;
    return {
      ...tick,
      ageMs: tick.publishTimeMs != null ? Date.now() - tick.publishTimeMs : null,
    };
  }

  isConnected(): boolean {
    return this.status === "CONNECTED";
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
