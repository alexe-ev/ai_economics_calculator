import { OptimizationInput, OptimizationOutput, OptimizationLayer } from "@/lib/types";

export function calculateOptimizationStack(input: OptimizationInput): OptimizationOutput {
  const {
    inputTokens,
    outputTokens,
    inputPricePerMTok,
    outputPricePerMTok,
    requestsPerMonth,
  } = input;

  const baselineCostPerRequest =
    (inputTokens / 1_000_000) * inputPricePerMTok +
    (outputTokens / 1_000_000) * outputPricePerMTok;
  const baselineMonthlyCost = baselineCostPerRequest * requestsPerMonth;

  const layers: OptimizationLayer[] = [];
  let currentCostPerRequest = baselineCostPerRequest;
  let currentInputTokens = inputTokens;
  let currentOutputTokens = outputTokens;

  // Layer 1: Output limits
  if (input.outputLimitsEnabled && input.newOutputTokens < outputTokens) {
    currentOutputTokens = input.newOutputTokens;
    const costAfterOutput =
      (currentInputTokens / 1_000_000) * inputPricePerMTok +
      (currentOutputTokens / 1_000_000) * outputPricePerMTok;
    const savingsPct = baselineCostPerRequest > 0
      ? 1 - costAfterOutput / baselineCostPerRequest
      : 0;
    currentCostPerRequest = costAfterOutput;
    layers.push({
      name: "Output Limits",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  } else {
    layers.push({
      name: "Output Limits",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: 0,
      cumulativeSavingsPct: 0,
    });
  }

  // Layer 2: Prompt caching
  if (input.promptCachingEnabled && input.cachedPrefixTokens > 0 && input.cacheHitRate > 0) {
    const cachedPrefix = Math.min(input.cachedPrefixTokens, currentInputTokens);
    const costCacheHit =
      (cachedPrefix / 1_000_000) * inputPricePerMTok * 0.1 +
      ((currentInputTokens - cachedPrefix) / 1_000_000) * inputPricePerMTok +
      (currentOutputTokens / 1_000_000) * outputPricePerMTok;
    const costCacheMiss = currentCostPerRequest;
    const blended =
      input.cacheHitRate * costCacheHit +
      (1 - input.cacheHitRate) * costCacheMiss;
    const layerSavings = currentCostPerRequest > 0
      ? 1 - blended / currentCostPerRequest
      : 0;
    currentCostPerRequest = blended;
    layers.push({
      name: "Prompt Caching",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: layerSavings,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  } else {
    layers.push({
      name: "Prompt Caching",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: 0,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  }

  // Layer 3: Semantic cache
  if (input.semanticCacheEnabled && input.faqTrafficShare > 0 && input.semanticHitRate > 0) {
    const deflectionRate = input.faqTrafficShare * input.semanticHitRate;
    const costAfterSemantic = (1 - deflectionRate) * currentCostPerRequest;
    const layerSavings = currentCostPerRequest > 0
      ? 1 - costAfterSemantic / currentCostPerRequest
      : 0;
    currentCostPerRequest = costAfterSemantic;
    layers.push({
      name: "Semantic Cache",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: layerSavings,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  } else {
    layers.push({
      name: "Semantic Cache",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: 0,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  }

  // Layer 4: Context management
  if (input.contextMgmtEnabled && input.contextReductionPct > 0) {
    const reducedInput = currentInputTokens * (1 - input.contextReductionPct);
    const costAfterContext =
      (reducedInput / 1_000_000) * inputPricePerMTok +
      (currentOutputTokens / 1_000_000) * outputPricePerMTok;
    // Apply context reduction proportionally to current cost
    // (preserving savings from previous layers)
    const contextSavingsRatio = currentCostPerRequest > 0
      ? costAfterContext / ((currentInputTokens / 1_000_000) * inputPricePerMTok + (currentOutputTokens / 1_000_000) * outputPricePerMTok)
      : 1;
    const costAfterAll = currentCostPerRequest * contextSavingsRatio;
    const layerSavings = currentCostPerRequest > 0
      ? 1 - costAfterAll / currentCostPerRequest
      : 0;
    currentCostPerRequest = costAfterAll;
    layers.push({
      name: "Context Management",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: layerSavings,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  } else {
    layers.push({
      name: "Context Management",
      costPerRequest: currentCostPerRequest,
      monthlyCost: currentCostPerRequest * requestsPerMonth,
      savingsPct: 0,
      cumulativeSavingsPct: baselineCostPerRequest > 0
        ? 1 - currentCostPerRequest / baselineCostPerRequest
        : 0,
    });
  }

  const finalMonthlyCost = currentCostPerRequest * requestsPerMonth;
  const cumulativeSavingsPct = baselineMonthlyCost > 0
    ? 1 - finalMonthlyCost / baselineMonthlyCost
    : 0;

  return {
    layers,
    baselineMonthlyCost,
    finalMonthlyCost,
    cumulativeSavingsPct,
  };
}
