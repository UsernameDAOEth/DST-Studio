export interface HermesAlertRouting {
  telegram: boolean;
  xmtp: boolean;
  discord: boolean;
}

export interface HermesConstraints {
  preferredAssets: string[];
  activeTimeframe: "1H" | "4H" | "1D";
  minRRThreshold: number;
  lateEntryAtrMultiplier: number;
  oneSignalPerAsset: boolean;
  browserbaseTriggerPolicy: "DISABLED" | "HIGH_CONFIDENCE" | "APPROVED_ONLY";
  pythConfidenceFilter: boolean;
  pythConfidenceThreshold: number;
  alertRouting: HermesAlertRouting;
  waitBiasPolicy: "STRICT" | "STANDARD" | "RELAXED";
  updatedAt: string;
}

export interface HermesJobPhase {
  stage: "DEFILAMMA" | "PYTH" | "BROWSERBASE" | "DJZS_AUDIT" | "ROUTING";
  status: "PENDING" | "RUNNING" | "COMPLETE" | "SKIPPED" | "FAILED";
  skippedReason?: string | null;
  durationMs?: number | null;
  result?: string | null;
}

export interface HermesJob {
  id: string;
  asset: string;
  scanStartedAt: string;
  scanCompletedAt?: string | null;
  phases: HermesJobPhase[];
  finalDirection?: "LONG" | "SHORT" | "WAIT" | null;
  finalProcessVerdict?: "APPROVED" | "REJECTED" | "DEGRADED" | null;
  setupFamily?: string | null;
  rejectionCodes: string[];
  triggered: boolean;
}

export interface HermesScanStatus {
  running: boolean;
  schedulerActive: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  scanIntervalMinutes: number;
  totalScansToday: number;
  totalApprovedToday: number;
  totalWaitToday: number;
  activeJobs: HermesJob[];
  recentJobs: HermesJob[];
  phase?: string;
}

export interface HermesScanResult {
  triggeredAt: string;
  assets: string[];
  jobIds: string[];
  message: string;
}

export interface HermesMetrics {
  period: "24H" | "7D" | "30D";
  totalScans: number;
  totalCandidates: number;
  totalApproved: number;
  totalDegraded: number;
  totalRejected: number;
  totalWait: number;
  waitRate: number;
  approvalRate: number;
  avgRROnApproved?: number | null;
  avgConfidenceOnApproved?: number | null;
  candidateAccuracy?: number | null;
  filterAccuracy?: number | null;
  timingAccuracy?: number | null;
  noTradeQuality?: number | null;
  researchLift?: number | null;
  alertUsefulness?: number | null;
  rejectionCodeBreakdown: Record<string, number>;
  setupFamilyBreakdown: Record<string, number>;
  pythInfluenceCount: number;
  computedAt: string;
}

export interface EvalReviewItem {
  parameter: string;
  currentValue: string;
  observation: string;
  recommendation: "KEEP" | "TIGHTEN" | "LOOSEN" | "REVIEW";
  rationale: string;
}

export interface HermesEvaluation {
  generatedAt: string;
  periodLabel: string;
  thresholdReview: EvalReviewItem[];
  rejectConditionReview: EvalReviewItem[];
  triggerRuleReview: EvalReviewItem[];
  routingRuleReview: EvalReviewItem[];
  overallAssessment: string;
  doctrineStatus: string;
}

export interface PythPriceData {
  asset: string;
  pythId: string;
  price: number;
  confidence: number;
  confidenceRatio: number;
  confidenceStatus: "HIGH" | "MEDIUM" | "LOW";
  emaPrice: number;
  emaConfidence: number;
  publishTime: string;
  slotAge: number;
  fresh: boolean;
  influencesProcessVerdict: boolean;
}
