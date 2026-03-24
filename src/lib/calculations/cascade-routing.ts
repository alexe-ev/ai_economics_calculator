import { CascadeRoutingInput, CascadeRoutingOutput } from "@/lib/types";

export function calculateCascadeRouting(
  input: CascadeRoutingInput
): CascadeRoutingOutput {
  const { totalRequestsPerMonth, classifierCostPerRequest, tiers } = input;

  const classifierCost = totalRequestsPerMonth * classifierCostPerRequest;

  const tierCosts = tiers.map((tier) => {
    const volume = Math.round(totalRequestsPerMonth * tier.trafficPct);
    const cost = volume * tier.costPerRequest;
    return { modelId: tier.modelId, cost, volume };
  });

  const totalTierCost = tierCosts.reduce((sum, t) => sum + t.cost, 0);
  const totalMonthlyCost = classifierCost + totalTierCost;

  const blendedCostPerRequest =
    totalRequestsPerMonth > 0 ? totalMonthlyCost / totalRequestsPerMonth : 0;

  const blendedQuality = tiers.reduce(
    (sum, tier) => sum + tier.trafficPct * tier.qualityScore,
    0
  );

  const maxCostPerReq = Math.max(...tiers.map((t) => t.costPerRequest));
  const allExpensiveCost = totalRequestsPerMonth * maxCostPerReq;

  const savingsVsExpensive =
    allExpensiveCost > 0 ? 1 - totalMonthlyCost / allExpensiveCost : 0;

  return {
    classifierCost,
    tierCosts,
    totalMonthlyCost,
    blendedCostPerRequest,
    blendedQuality,
    allExpensiveCost,
    savingsVsExpensive,
  };
}
