import * as fs from 'fs';
import { HermesConstraints } from "./types";
import { logger } from "../logger";

const CONSTRAINTS_PATH = "/tmp/hermes-constraints.json";

export const DEFAULT_CONSTRAINTS: HermesConstraints = {
  preferredAssets: ["BTC", "ETH", "SOL"],
  activeTimeframe: "4H",
  minRRThreshold: 1.5,
  lateEntryAtrMultiplier: 1.5,
  oneSignalPerAsset: true,
  browserbaseTriggerPolicy: "DISABLED",
  pythConfidenceFilter: false,
  pythConfidenceThreshold: 0.95,
  alertRouting: { telegram: false, xmtp: false, discord: false },
  waitBiasPolicy: "STRICT",
  updatedAt: new Date().toISOString(),
};

let currentConstraints: HermesConstraints | null = null;

function loadFromDisk(): HermesConstraints {
  try {
    if (fs.existsSync(CONSTRAINTS_PATH)) {
      const data = fs.readFileSync(CONSTRAINTS_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed as HermesConstraints;
    }
  } catch (error) {
    logger.error({ error }, "Failed to load constraints from disk");
  }
  return DEFAULT_CONSTRAINTS;
}

function saveToDisk(constraints: HermesConstraints) {
  try {
    fs.writeFileSync(CONSTRAINTS_PATH, JSON.stringify(constraints, null, 2));
  } catch (error) {
    logger.error({ error }, "Failed to save constraints to disk");
  }
}

export function getConstraints(): HermesConstraints {
  if (!currentConstraints) {
    currentConstraints = loadFromDisk();
  }
  return currentConstraints;
}

export async function updateConstraints(partial: Partial<HermesConstraints>): Promise<HermesConstraints> {
  const existing = getConstraints();
  currentConstraints = {
    ...existing,
    ...partial,
    updatedAt: new Date().toISOString(),
  } as HermesConstraints;
  saveToDisk(currentConstraints);
  return currentConstraints;
}
