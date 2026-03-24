import {
  TokenCostInput,
  TokenCostOutput,
  ModelComparisonRow,
} from "@/lib/types";
import { MODEL_PRICES, LANGUAGE_MULTIPLIERS, getModel } from "@/lib/data/models";

function getLanguageMultiplier(language: TokenCostInput["language"]): number {
  return LANGUAGE_MULTIPLIERS[language] ?? 1.0;
}

function calcBaseCost(
  inputTokens: number,
  outputTokens: number,
  inputPrice: number,
  outputPrice: number
): number {
  return (inputTokens / 1_000_000) * inputPrice +
    (outputTokens / 1_000_000) * outputPrice;
}


export function calculateTokenCost(input: TokenCostInput): TokenCostOutput {
  const model = getModel(input.modelId);
  if (!model) {
    return {
      costPerRequest: 0,
      inputCost: 0,
      outputCost: 0,
      thinkingCost: 0,
      monthlyCost: 0,
      outputSharePct: 0,
      modelComparison: [],
    };
  }

  const langMul = getLanguageMultiplier(input.language);
  const adjInput = input.inputTokens * langMul;
  const adjOutput = input.outputTokens * langMul;
  const adjCached = input.cachedTokens * langMul;
  const adjThinking = input.thinkingTokens * langMul;

  const result = calcForModel(
    model.inputPricePerMTok,
    model.outputPricePerMTok,
    adjInput,
    adjOutput,
    adjCached,
    adjThinking,
    input
  );

  const mrrSharePct =
    input.mrrForIndicator && input.mrrForIndicator > 0
      ? result.monthlyCost / input.mrrForIndicator
      : undefined;

  // Model comparison: calculate same workload across all models
  const modelComparison: ModelComparisonRow[] = MODEL_PRICES.map((m) => {
    const comp = calcForModel(
      m.inputPricePerMTok,
      m.outputPricePerMTok,
      adjInput,
      adjOutput,
      adjCached,
      adjThinking,
      input
    );
    return {
      modelId: m.id,
      modelName: m.name,
      costPerRequest: comp.costPerRequest,
      monthlyCost: comp.monthlyCost,
    };
  }).sort((a, b) => a.costPerRequest - b.costPerRequest);

  return {
    ...result,
    mrrSharePct,
    modelComparison,
  };
}

export function calculateModelComparison(
  input: TokenCostInput
): ModelComparisonRow[] {
  return calculateTokenCost(input).modelComparison;
}

export function calculateForModel(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  language: string
): { costPerRequest: number; monthlyCost: number } {
  const model = getModel(modelId);
  if (!model) return { costPerRequest: 0, monthlyCost: 0 };
  const langMul = LANGUAGE_MULTIPLIERS[language] ?? 1.0;
  const adjInput = inputTokens * langMul;
  const adjOutput = outputTokens * langMul;
  const cost =
    (adjInput / 1_000_000) * model.inputPricePerMTok +
    (adjOutput / 1_000_000) * model.outputPricePerMTok;
  return { costPerRequest: cost, monthlyCost: cost * 10000 };
}

function calcForModel(
  inputPrice: number,
  outputPrice: number,
  adjInput: number,
  adjOutput: number,
  adjCached: number,
  adjThinking: number,
  input: TokenCostInput
): Omit<TokenCostOutput, "modelComparison" | "mrrSharePct"> {
  let inputCost: number;
  let outputCost: number;
  let thinkingCost = 0;

  if (input.extendedThinking && adjThinking > 0) {
    // Thinking tokens priced as output
    inputCost = (adjInput / 1_000_000) * inputPrice;
    outputCost = (adjOutput / 1_000_000) * outputPrice;
    thinkingCost = (adjThinking / 1_000_000) * outputPrice;
  } else if (input.promptCaching && adjCached > 0) {
    // Prompt caching: blended cost
    const uncachedInput = adjInput - adjCached;
    const cachedInputCost = (adjCached / 1_000_000) * inputPrice * 0.1;
    const uncachedInputCost = (uncachedInput / 1_000_000) * inputPrice;
    const fullInputCost = (adjInput / 1_000_000) * inputPrice;
    inputCost =
      input.cacheHitRate * (cachedInputCost + uncachedInputCost) +
      (1 - input.cacheHitRate) * fullInputCost;
    outputCost = (adjOutput / 1_000_000) * outputPrice;
  } else {
    inputCost = (adjInput / 1_000_000) * inputPrice;
    outputCost = (adjOutput / 1_000_000) * outputPrice;
  }

  let costPerRequest = inputCost + outputCost + thinkingCost;

  // Batch API: 50% discount on total
  if (input.batchApi) {
    costPerRequest *= 0.5;
    inputCost *= 0.5;
    outputCost *= 0.5;
    thinkingCost *= 0.5;
  }

  const monthlyCost = costPerRequest * input.requestsPerMonth;
  const totalTokenCost = inputCost + outputCost + thinkingCost;
  const outputSharePct = totalTokenCost > 0 ? outputCost / totalTokenCost : 0;

  return {
    costPerRequest,
    inputCost,
    outputCost,
    thinkingCost,
    monthlyCost,
    outputSharePct,
  };
}
