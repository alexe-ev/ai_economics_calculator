import type {
  TokenCostInput,
  OptimizationInput,
  CascadeRoutingInput,
  AgentCostInput,
  UnitEconomicsInput,
  EconomicsBriefInput,
} from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/constants";

const tokenCost: TokenCostInput = {
  inputTokens: 3000,
  outputTokens: 500,
  modelId: "claude-sonnet",
  language: "en",
  batchApi: false,
  promptCaching: false,
  cacheHitRate: 0.5,
  cachedTokens: 500,
  extendedThinking: false,
  thinkingTokens: 1000,
  requestsPerMonth: 80000,
  mrrForIndicator: 12000,
};

const optimization: OptimizationInput = {
  inputTokens: 3000,
  outputTokens: 500,
  inputPricePerMTok: 3.0,
  outputPricePerMTok: 15.0,
  requestsPerMonth: 80000,
  outputLimitsEnabled: true,
  newOutputTokens: 300,
  promptCachingEnabled: true,
  cachedPrefixTokens: 2000,
  cacheHitRate: 0.7,
  semanticCacheEnabled: true,
  faqTrafficShare: 0.4,
  semanticHitRate: 0.67,
  contextMgmtEnabled: true,
  contextReductionPct: 0.2,
};

const cascadeRouting: CascadeRoutingInput = {
  totalRequestsPerMonth: 80000,
  classifierModelId: "claude-haiku",
  classifierCostPerRequest: 0.00005,
  tiers: [
    { modelId: "claude-haiku", trafficPct: 0.75, costPerRequest: 0.003, qualityScore: 94 },
    { modelId: "claude-sonnet", trafficPct: 0.20, costPerRequest: 0.013, qualityScore: 96 },
    { modelId: "claude-opus", trafficPct: 0.05, costPerRequest: 0.042, qualityScore: 98 },
  ],
};

const agentCost: AgentCostInput = {
  steps: [
    { newInputTokens: 3000, outputTokens: 500, modelId: "claude-sonnet", toolUse: true, toolResultTokens: 800 },
    { newInputTokens: 500, outputTokens: 600, modelId: "claude-sonnet", toolUse: true, toolResultTokens: 500 },
    { newInputTokens: 300, outputTokens: 400, modelId: "claude-sonnet", toolUse: true, toolResultTokens: 300 },
    { newInputTokens: 200, outputTokens: 300, modelId: "claude-sonnet", toolUse: false },
  ],
  toolDefinitions: {
    numTools: 8,
    avgToolDefSize: 250,
    systemOverhead: 500,
  },
  mode: "single-agent",
  multiAgent: {
    numSpecialists: 3,
    orchestratorModelId: "claude-sonnet",
    orchestratorCostPerCall: 0.01,
    handoffTokens: 500,
  },
  successRate: 0.6,
  retryRate: 0.15,
};

const unitEconomics: UnitEconomicsInput = {
  numUsers: 200,
  inferenceCostMonthly: 3768,
  embeddingCostMonthly: 20,
  vectorDbMonthly: 150,
  monitoringMonthly: 50,
  fineTuningMonthly: 0,
  errorOverheadPct: 0.15,
  safetyOverheadPct: 0.10,
  segments: [
    { name: "Light", userPct: 0.6, avgRequestsPerMonth: 300, avgCostPerRequest: 0.015, revenuePerUser: 0 },
    { name: "Regular", userPct: 0.3, avgRequestsPerMonth: 500, avgCostPerRequest: 0.055, revenuePerUser: 29 },
    { name: "Power", userPct: 0.1, avgRequestsPerMonth: 1200, avgCostPerRequest: 0.08, revenuePerUser: 99 },
  ],
  humanCostPerOutcome: 10,
  aiResolutionRate: 0.6,
  totalRequestsPerMonth: 80000,
};

const economicsBrief: EconomicsBriefInput = {
  taskDescription: "B2B SaaS support copilot: automated customer ticket classification, resolution, and escalation",
  inputTokens: 3000,
  outputTokens: 500,
  requestsPerDay: 2667,
  requestsPerMonth: 80000,
  modelId: "claude-sonnet",
  modelReason: "Best quality/cost balance for support tasks requiring nuanced understanding",
  costPerRequest: 0.047,
  monthlyCost: 3768,
  humanCostPerUnit: 10,
};

export const DEMO_PRESET = {
  tokenCost,
  optimization,
  cascadeRouting,
  agentCost,
  unitEconomics,
  economicsBrief,
};

export function loadPreset(preset: typeof DEMO_PRESET): void {
  try {
    localStorage.setItem(STORAGE_KEYS.tokenCost, JSON.stringify(preset.tokenCost));
    localStorage.setItem(STORAGE_KEYS.optimization, JSON.stringify(preset.optimization));
    localStorage.setItem(STORAGE_KEYS.cascadeRouting, JSON.stringify(preset.cascadeRouting));
    localStorage.setItem(STORAGE_KEYS.agentCost, JSON.stringify(preset.agentCost));
    localStorage.setItem(STORAGE_KEYS.unitEconomics, JSON.stringify(preset.unitEconomics));
    localStorage.setItem(STORAGE_KEYS.economicsBrief, JSON.stringify(preset.economicsBrief));
    localStorage.removeItem(STORAGE_KEYS.zustand);
    localStorage.removeItem(STORAGE_KEYS.optimizationOverrides);
    localStorage.removeItem(STORAGE_KEYS.cascadeOverrides);
    localStorage.removeItem(STORAGE_KEYS.unitEconomicsOverrides);
    localStorage.removeItem(STORAGE_KEYS.economicsBriefOverrides);
  } catch {
    // localStorage full or unavailable
  }
}

export function clearPreset(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable
  }
}
