// Model reference data
export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  contextWindow: number;
  snapshotDate: string;
}

export interface GpuPricing {
  id: string;
  name: string;
  vram: number;
  hyperscalerHourly: [number, number]; // [min, max]
  specializedHourly: [number, number];
  throughput8B: [number, number]; // req/s range
  snapshotDate: string;
}

export interface CachePricing {
  provider: string;
  cacheWriteMultiplier: number;
  cacheReadMultiplier: number;
  ttl: string;
  minTokens: number;
  snapshotDate: string;
}

// Module 2.1: Token Cost Calculator
export interface TokenCostInput {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  language: "en" | "ru" | "zh" | "ar" | "other";
  batchApi: boolean;
  promptCaching: boolean;
  cacheHitRate: number; // 0-1
  cachedTokens: number;
  extendedThinking: boolean;
  thinkingTokens: number;
  requestsPerMonth: number;
  mrrForIndicator?: number;
}

export interface TokenCostOutput {
  costPerRequest: number;
  inputCost: number;
  outputCost: number;
  thinkingCost: number;
  monthlyCost: number;
  outputSharePct: number;
  mrrSharePct?: number;
  modelComparison: ModelComparisonRow[];
}

export interface ModelComparisonRow {
  modelId: string;
  modelName: string;
  costPerRequest: number;
  monthlyCost: number;
}

// Module 2.2: Optimization Stack
export interface OptimizationInput {
  inputTokens: number;
  outputTokens: number;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  requestsPerMonth: number;
  // Layer 1: Output limits
  outputLimitsEnabled: boolean;
  newOutputTokens: number;
  // Layer 2: Prompt caching
  promptCachingEnabled: boolean;
  cachedPrefixTokens: number;
  cacheHitRate: number; // 0-1
  // Layer 3: Semantic cache
  semanticCacheEnabled: boolean;
  faqTrafficShare: number; // 0-1
  semanticHitRate: number; // 0-1
  // Layer 4: Context management
  contextMgmtEnabled: boolean;
  contextReductionPct: number; // 0-1
}

export interface OptimizationOutput {
  layers: OptimizationLayer[];
  baselineMonthlyCost: number;
  finalMonthlyCost: number;
  cumulativeSavingsPct: number;
}

export interface OptimizationLayer {
  name: string;
  costPerRequest: number;
  monthlyCost: number;
  savingsPct: number;
  cumulativeSavingsPct: number;
}

// Module 2.4: Cascade Routing
export interface CascadeRoutingInput {
  totalRequestsPerMonth: number;
  classifierModelId: string;
  classifierCostPerRequest: number;
  tiers: CascadeTier[];
}

export interface CascadeTier {
  modelId: string;
  trafficPct: number; // 0-1, sum = 1
  costPerRequest: number;
  qualityScore: number; // 0-100
}

export interface CascadeRoutingOutput {
  classifierCost: number;
  tierCosts: { modelId: string; cost: number; volume: number }[];
  totalMonthlyCost: number;
  blendedCostPerRequest: number;
  blendedQuality: number;
  allExpensiveCost: number;
  savingsVsExpensive: number;
}

// Module 2.7: Agent Cost Estimator
export interface AgentCostInput {
  steps: AgentStep[];
  toolDefinitions: {
    numTools: number;
    avgToolDefSize: number;
    systemOverhead: number; // 300-700 tokens
  };
  mode: "single-agent" | "multi-agent";
  multiAgent?: {
    numSpecialists: number;
    orchestratorModelId: string;
    orchestratorCostPerCall: number;
    handoffTokens: number;
  };
  successRate: number; // 0-1
  retryRate: number; // 0-1
  escalationModelId?: string;
}

export interface AgentStep {
  newInputTokens: number;
  outputTokens: number;
  modelId: string;
  toolUse: boolean;
  toolResultTokens?: number;
}

export interface AgentCostOutput {
  steps: AgentStepCost[];
  costPerIntent: number;
  costPerOutcome: number;
  singleCallBaseline: number;
  multiplierVsBaseline: number;
  toolOverheadTotal: number;
  toolOverheadPct: number;
  multiAgentOverhead?: number;
  multiAgentOverheadPct?: number;
  totalContextTokens: number;
}

export interface AgentStepCost {
  step: number;
  contextSize: number;
  effectiveInput: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

// Module 2.9: Unit Economics Dashboard
export interface UnitEconomicsInput {
  // Revenue
  subscriptionPrice: number;
  numUsers: number;
  mrr?: number;
  // COGS
  inferenceCostMonthly: number;
  embeddingCostMonthly: number;
  vectorDbMonthly: number;
  monitoringMonthly: number;
  fineTuningMonthly: number;
  errorOverheadPct: number; // 0-1
  safetyOverheadPct: number; // 0-1
  // User distribution
  segments: UserSegment[];
  // Human alternative
  humanCostPerOutcome: number;
  aiResolutionRate: number; // 0-1
  totalRequestsPerMonth: number;
}

export interface UserSegment {
  name: string;
  userPct: number; // 0-1
  avgRequestsPerMonth: number;
  avgCostPerRequest: number;
}

export interface UnitEconomicsOutput {
  fleetCogs: number;
  cogsBreakdown: { component: string; amount: number; pct: number }[];
  fleetGrossMargin: number;
  marginZone: "healthy" | "monitor" | "action" | "critical";
  cogsPerUser: number;
  revenuePerUser: number;
  grossProfitPerUser: number;
  segments: SegmentAnalysis[];
  costPerResolved: number;
  blendedCostPerProblem: number;
  breakevenResolutionRate: number;
}

export interface SegmentAnalysis {
  name: string;
  users: number;
  requestsPerMonth: number;
  cogsPerUser: number;
  margin: number;
  isNegativeMargin: boolean;
}

// Module 2.13: Economics Brief
export interface EconomicsBriefInput {
  taskDescription: string;
  inputTokens: number;
  outputTokens: number;
  requestsPerDay: number;
  requestsPerMonth: number;
  modelId: string;
  modelReason: string;
  costPerRequest: number;
  monthlyCost: number;
  humanCostPerUnit: number;
}

export interface EconomicsBriefOutput {
  brief: string;
  breakEvenVolume: number;
  aiToHumanRatio: number;
  unknownFieldsCount: number;
}

// Shared store types
export interface SharedCalculatorState {
  // From Token Cost (2.1)
  tokenCost?: {
    costPerRequest: number;
    inputTokens: number;
    outputTokens: number;
    modelId: string;
    monthlyCost: number;
    inputPricePerMTok: number;
    outputPricePerMTok: number;
    requestsPerMonth: number;
  };
  // From Optimization Stack (2.2)
  optimization?: {
    optimizedCostPerRequest: number;
    savingsPct: number;
  };
  // From Cascade Routing (2.4)
  cascadeRouting?: {
    blendedCostPerRequest: number;
    blendedQuality: number;
  };
  // From Agent Cost (2.7)
  agentCost?: {
    costPerIntent: number;
    costPerOutcome: number;
  };
  // From Unit Economics (2.9)
  unitEconomics?: {
    cogsPerUser: number;
    fleetGrossMargin: number;
    segments: UserSegment[];
    humanCostPerOutcome: number;
  };
}
