import { atr, lastEma } from "./indicators";

export type TradingSignal = "LONG" | "SHORT" | "WAIT";

export type TradingSignalRequest = {
  symbol?: unknown;
  instrument?: unknown;
  venue?: unknown;
  timeframe?: unknown;
  marketSnapshot?: unknown;
};

export type TradingSignalResponse = {
  ok: true;
  symbol: string | null;
  venue: string | null;
  timeframe: string | null;
  signal: TradingSignal;
  confidence: number;
  reasonCodes: string[];
  timestamp: string;
  engine: "deterministic-signal-v0";
};

type ParsedCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  confirmed: boolean;
};

type TrendDirection = "UP" | "DOWN" | "UNCLEAR";

const MIN_CANDLES = 60;
const FAST_EMA = 20;
const SLOW_EMA = 50;
const MIN_TREND_BPS = 8;
const MIN_SLOPE_BPS = 2;
const VOLUME_LOOKBACK = 20;
const MIN_VOLUME_RATIO = 1.2;
const MIN_ATR_BPS = 2;
const MAX_ATR_BPS = 250;
const MAX_SINGLE_CANDLE_RANGE_BPS = 400;

function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberFrom(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readNested(input: unknown, key: string): unknown {
  const record = asRecord(input);
  const direct = record[key];
  if (direct !== undefined) return direct;

  const data = record["data"];
  if (Array.isArray(data) && data.length > 0) {
    return asRecord(data[0])[key];
  }

  return undefined;
}

function parseArrayCandle(value: unknown[]): ParsedCandle | null {
  const timestamp = numberFrom(value[0]);
  const open = numberFrom(value[1]);
  const high = numberFrom(value[2]);
  const low = numberFrom(value[3]);
  const close = numberFrom(value[4]);
  const quoteVolume = numberFrom(value[7]);
  const baseVolume = numberFrom(value[5]);

  if (
    timestamp === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    high < low ||
    close <= 0
  ) {
    return null;
  }

  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: quoteVolume ?? baseVolume ?? 0,
    confirmed: value[8] === undefined || String(value[8]) === "1",
  };
}

function parseObjectCandle(value: unknown): ParsedCandle | null {
  const record = asRecord(value);
  const timestamp = numberFrom(record["ts"] ?? record["timestamp"] ?? record["time"]);
  const open = numberFrom(record["o"] ?? record["open"]);
  const high = numberFrom(record["h"] ?? record["high"]);
  const low = numberFrom(record["l"] ?? record["low"]);
  const close = numberFrom(record["c"] ?? record["close"]);
  const volume = numberFrom(record["volCcyQuote"] ?? record["volumeQuote"] ?? record["volume"] ?? record["vol"]);
  const confirmedRaw = record["confirm"] ?? record["confirmed"];

  if (
    timestamp === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    high < low ||
    close <= 0
  ) {
    return null;
  }

  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: volume ?? 0,
    confirmed: confirmedRaw === undefined || confirmedRaw === true || String(confirmedRaw) === "1",
  };
}

function extractCandles(input: TradingSignalRequest): ParsedCandle[] {
  const snapshot = asRecord(input.marketSnapshot);
  const rawCandles = snapshot["candles"] ?? readNested(input.marketSnapshot, "candles");
  if (!Array.isArray(rawCandles)) return [];

  return rawCandles
    .map((item) => {
      if (Array.isArray(item)) return parseArrayCandle(item);
      return parseObjectCandle(item);
    })
    .filter((item): item is ParsedCandle => item !== null)
    .filter((item) => item.confirmed)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rangeBps(candle: ParsedCandle): number {
  return ((candle.high - candle.low) / candle.close) * 10_000;
}

function analyzeTrend(candles: ParsedCandle[]): { direction: TrendDirection; reasonCodes: string[] } {
  const closes = candles.map((candle) => candle.close);
  const fast = lastEma(closes, FAST_EMA);
  const slow = lastEma(closes, SLOW_EMA);
  const previousCloses = closes.slice(0, -5);
  const previousFast = lastEma(previousCloses, FAST_EMA);
  const previousSlow = lastEma(previousCloses, SLOW_EMA);
  const lastClose = closes[closes.length - 1] ?? 0;
  const spreadBps = lastClose > 0 ? ((fast - slow) / lastClose) * 10_000 : 0;
  const slopeBps = lastClose > 0 ? (((fast - slow) - (previousFast - previousSlow)) / lastClose) * 10_000 : 0;

  if (spreadBps >= MIN_TREND_BPS && slopeBps >= MIN_SLOPE_BPS) {
    return { direction: "UP", reasonCodes: ["TREND_UP_CONFIRMED"] };
  }

  if (spreadBps <= -MIN_TREND_BPS && slopeBps <= -MIN_SLOPE_BPS) {
    return { direction: "DOWN", reasonCodes: ["TREND_DOWN_CONFIRMED"] };
  }

  return { direction: "UNCLEAR", reasonCodes: ["TREND_UNCLEAR"] };
}

function analyzeVolume(candles: ParsedCandle[], trend: TrendDirection): { confirmed: boolean; reasonCodes: string[] } {
  if (trend === "UNCLEAR") {
    return { confirmed: false, reasonCodes: ["VOLUME_SKIPPED_TREND_UNCLEAR"] };
  }

  const latest = candles[candles.length - 1];
  const previous = candles.slice(-(VOLUME_LOOKBACK + 1), -1);
  if (!latest || previous.length < VOLUME_LOOKBACK) {
    return { confirmed: false, reasonCodes: ["VOLUME_INSUFFICIENT_HISTORY"] };
  }

  const baseline = average(previous.map((candle) => candle.volume).filter((value) => value > 0));
  if (baseline <= 0 || latest.volume <= 0) {
    return { confirmed: false, reasonCodes: ["VOLUME_MISSING"] };
  }

  const ratio = latest.volume / baseline;
  const bullishBody = latest.close > latest.open;
  const bearishBody = latest.close < latest.open;
  const directionMatches = (trend === "UP" && bullishBody) || (trend === "DOWN" && bearishBody);

  if (ratio >= MIN_VOLUME_RATIO && directionMatches) {
    return { confirmed: true, reasonCodes: ["VOLUME_CONFIRMED"] };
  }

  return { confirmed: false, reasonCodes: ["VOLUME_NOT_CONFIRMED"] };
}

function analyzeVolatility(candles: ParsedCandle[]): { stable: boolean; reasonCodes: string[] } {
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const closes = candles.map((candle) => candle.close);
  const latestClose = closes[closes.length - 1] ?? 0;
  const latestRangeBps = candles.length > 0 ? rangeBps(candles[candles.length - 1] as ParsedCandle) : 0;
  const atrValue = atr(highs, lows, closes, 14);
  const atrBps = latestClose > 0 ? (atrValue / latestClose) * 10_000 : 0;

  if (atrBps < MIN_ATR_BPS) {
    return { stable: false, reasonCodes: ["VOLATILITY_TOO_LOW"] };
  }

  if (atrBps > MAX_ATR_BPS || latestRangeBps > MAX_SINGLE_CANDLE_RANGE_BPS) {
    return { stable: false, reasonCodes: ["VOLATILITY_UNSTABLE"] };
  }

  return { stable: true, reasonCodes: ["VOLATILITY_STABLE"] };
}

export function computeTradingSignal(input: TradingSignalRequest): TradingSignalResponse {
  const snapshot = asRecord(input.marketSnapshot);
  const symbol = cleanField(input.symbol) ?? cleanField(input.instrument) ?? cleanField(snapshot["instrument"]);
  const venue = cleanField(input.venue);
  const timeframe = cleanField(input.timeframe);
  const baseResponse = {
    ok: true as const,
    symbol,
    venue,
    timeframe,
    timestamp: new Date().toISOString(),
    engine: "deterministic-signal-v0" as const,
  };

  if (!symbol || !venue || !timeframe) {
    return {
      ...baseResponse,
      signal: "WAIT",
      confidence: 0,
      reasonCodes: ["MISSING_REQUIRED_INPUT"],
    };
  }

  const candles = extractCandles(input);
  if (candles.length < MIN_CANDLES) {
    return {
      ...baseResponse,
      signal: "WAIT",
      confidence: 1,
      reasonCodes: ["SAFE_DEFAULT_NO_MARKET_FEATURES_CONNECTED"],
    };
  }

  const trend = analyzeTrend(candles);
  const volume = analyzeVolume(candles, trend.direction);
  const volatility = analyzeVolatility(candles);
  const reasonCodes = [...trend.reasonCodes, ...volume.reasonCodes, ...volatility.reasonCodes];

  if (trend.direction === "UNCLEAR" || !volume.confirmed || !volatility.stable) {
    return {
      ...baseResponse,
      signal: "WAIT",
      confidence: 1,
      reasonCodes,
    };
  }

  return {
    ...baseResponse,
    signal: trend.direction === "UP" ? "LONG" : "SHORT",
    confidence: 85,
    reasonCodes,
  };
}
