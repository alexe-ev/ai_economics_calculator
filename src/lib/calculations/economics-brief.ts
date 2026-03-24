import { EconomicsBriefInput, EconomicsBriefOutput } from "@/lib/types";
import { getModel } from "@/lib/data/models";

export function generateEconomicsBrief(
  input: EconomicsBriefInput
): EconomicsBriefOutput {
  const model = getModel(input.modelId);
  const modelName = model?.name ?? input.modelId;
  const inputPrice = model?.inputPricePerMTok ?? 0;
  const outputPrice = model?.outputPricePerMTok ?? 0;

  const calculatedCostPerRequest =
    (input.inputTokens / 1_000_000) * inputPrice +
    (input.outputTokens / 1_000_000) * outputPrice;

  // Use manual override if provided (non-zero and differs from calculated), otherwise use calculated
  const costPerRequest =
    input.costPerRequest > 0 &&
    Math.abs(input.costPerRequest - calculatedCostPerRequest) > 0.0000001
      ? input.costPerRequest
      : calculatedCostPerRequest;

  const monthlyCost =
    input.monthlyCost > 0 &&
    Math.abs(input.monthlyCost - costPerRequest * input.requestsPerMonth) > 0.01
      ? input.monthlyCost
      : costPerRequest * input.requestsPerMonth;

  const humanCost = input.humanCostPerUnit;
  const aiToHumanRatio = humanCost > 0 ? costPerRequest / humanCost : 0;

  // Break-even: if AI cost per request < human cost, AI is cheaper from request #1.
  // Otherwise, AI is never cheaper on a per-unit basis (breakeven = 0 means never).
  let breakEvenVolume: number;
  if (costPerRequest <= 0 || humanCost <= 0) {
    breakEvenVolume = 0;
  } else if (costPerRequest < humanCost) {
    breakEvenVolume = 1;
  } else {
    // AI is more expensive per request. No break-even on volume alone.
    breakEvenVolume = 0;
  }

  // Count unknown/empty fields
  const fields: Array<string | number> = [
    input.taskDescription,
    input.inputTokens,
    input.outputTokens,
    input.requestsPerDay,
    input.requestsPerMonth,
    input.modelId,
    input.modelReason,
    input.humanCostPerUnit,
  ];
  const unknownFieldsCount = fields.filter((f) => {
    if (typeof f === "string") return f.trim() === "";
    return f === 0;
  }).length;

  // Build brief text
  const lines = [
    `Task: ${input.taskDescription || "(not specified)"}`,
    `Estimated tokens/request: input ${input.inputTokens.toLocaleString()} + output ${input.outputTokens.toLocaleString()}`,
    `Expected volume: ${input.requestsPerDay.toLocaleString()} /day → ${input.requestsPerMonth.toLocaleString()} /month`,
    `Model tier: ${modelName} — reason: ${input.modelReason || "(not specified)"}`,
    `Projected cost/request: (${input.inputTokens.toLocaleString()}/1M × $${inputPrice}) + (${input.outputTokens.toLocaleString()}/1M × $${outputPrice}) = $${costPerRequest.toFixed(6)}`,
    `Projected cost/month: $${costPerRequest.toFixed(6)} × ${input.requestsPerMonth.toLocaleString()} = $${monthlyCost.toFixed(2)}`,
    `Alternative: human at $${humanCost.toFixed(2)}/unit`,
    breakEvenVolume === 1
      ? `Break-even: AI is cheaper from request #1 (${(aiToHumanRatio * 100).toFixed(1)}% of human cost)`
      : breakEvenVolume === 0 && costPerRequest >= humanCost && humanCost > 0
        ? `Break-even: AI is more expensive per request ($${costPerRequest.toFixed(6)} vs $${humanCost.toFixed(2)})`
        : `Break-even: insufficient data`,
  ];

  return {
    brief: lines.join("\n"),
    breakEvenVolume,
    aiToHumanRatio,
    unknownFieldsCount,
  };
}
