import {
  UnitEconomicsInput,
  UnitEconomicsOutput,
  SegmentAnalysis,
} from "@/lib/types";
import { getMarginZone } from "@/lib/data/thresholds";

export function calculateUnitEconomics(
  input: UnitEconomicsInput
): UnitEconomicsOutput {
  const {
    numUsers,
    inferenceCostMonthly,
    embeddingCostMonthly,
    vectorDbMonthly,
    monitoringMonthly,
    fineTuningMonthly,
    errorOverheadPct,
    safetyOverheadPct,
    segments,
    humanCostPerOutcome,
    aiResolutionRate,
    totalRequestsPerMonth,
  } = input;

  // MRR = sum of (revenuePerUser * users) for each segment
  const mrr = segments.reduce(
    (acc, seg) => acc + seg.revenuePerUser * Math.round(seg.userPct * numUsers),
    0
  );
  // Weighted average revenue per user
  const revenuePerUser = numUsers > 0 ? mrr / numUsers : 0;

  // Base COGS (before overhead multipliers)
  const baseCogs =
    inferenceCostMonthly +
    embeddingCostMonthly +
    vectorDbMonthly +
    monitoringMonthly +
    fineTuningMonthly;

  const errorOverheadAmount = baseCogs * errorOverheadPct;
  const safetyOverheadAmount = baseCogs * safetyOverheadPct;

  // Fleet COGS = base + error overhead + safety overhead
  const fleetCogs = baseCogs + errorOverheadAmount + safetyOverheadAmount;

  // COGS breakdown
  const breakdownRaw = [
    { component: "Inference", amount: inferenceCostMonthly },
    { component: "Embedding", amount: embeddingCostMonthly },
    { component: "Vector DB", amount: vectorDbMonthly },
    { component: "Monitoring", amount: monitoringMonthly },
    { component: "Fine-tuning", amount: fineTuningMonthly },
    { component: "Error overhead", amount: errorOverheadAmount },
    { component: "Safety overhead", amount: safetyOverheadAmount },
  ];
  const cogsBreakdown = breakdownRaw.map((item) => ({
    ...item,
    pct: fleetCogs > 0 ? item.amount / fleetCogs : 0,
  }));

  // COGS per user (fleet average)
  const cogsPerUser = numUsers > 0 ? fleetCogs / numUsers : 0;

  // Gross margin
  const grossProfitPerUser = revenuePerUser - cogsPerUser;
  const fleetGrossMargin =
    revenuePerUser > 0 ? (grossProfitPerUser / revenuePerUser) * 100 : 0;
  const marginZone = getMarginZone(fleetGrossMargin);

  // Per-segment analysis
  // infra_per_user: non-inference fixed costs spread per user
  const infraPerUser =
    numUsers > 0
      ? (vectorDbMonthly + monitoringMonthly + fineTuningMonthly) / numUsers
      : 0;

  const segmentAnalysis: SegmentAnalysis[] = segments.map((seg) => {
    const users = Math.round(seg.userPct * numUsers);
    const segCogsPerUser =
      seg.avgRequestsPerMonth * seg.avgCostPerRequest + infraPerUser;
    // Apply overhead multipliers to segment COGS too
    const segCogsWithOverhead =
      segCogsPerUser * (1 + errorOverheadPct + safetyOverheadPct);
    const segMargin =
      seg.revenuePerUser > 0
        ? ((seg.revenuePerUser - segCogsWithOverhead) / seg.revenuePerUser) * 100
        : 0;

    return {
      name: seg.name,
      users,
      requestsPerMonth: seg.avgRequestsPerMonth,
      cogsPerUser: segCogsWithOverhead,
      revenuePerUser: seg.revenuePerUser,
      margin: segMargin,
      isNegativeMargin: segCogsWithOverhead > seg.revenuePerUser,
    };
  });

  // Cost per successful outcome
  // total_cogs / (volume * resolution_rate)
  const effectiveResolutionRate = Math.max(aiResolutionRate, 0.01);
  const costPerResolved =
    totalRequestsPerMonth > 0
      ? fleetCogs / (totalRequestsPerMonth * effectiveResolutionRate)
      : 0;

  // Blended cost per problem solved
  // (resolution_rate * avg_ai_cost) + ((1 - resolution_rate) * human_cost)
  const avgAiCostPerRequest =
    totalRequestsPerMonth > 0 ? fleetCogs / totalRequestsPerMonth : 0;
  const blendedCostPerProblem =
    aiResolutionRate * avgAiCostPerRequest +
    (1 - aiResolutionRate) * humanCostPerOutcome;

  // Breakeven resolution rate
  // breakeven_rate = total_ai_overhead / (volume * human_cost)
  const breakevenResolutionRate =
    totalRequestsPerMonth * humanCostPerOutcome > 0
      ? fleetCogs / (totalRequestsPerMonth * humanCostPerOutcome)
      : 0;

  return {
    fleetCogs,
    cogsBreakdown,
    fleetGrossMargin,
    marginZone,
    cogsPerUser,
    revenuePerUser,
    mrr,
    grossProfitPerUser,
    segments: segmentAnalysis,
    costPerResolved,
    blendedCostPerProblem,
    breakevenResolutionRate,
  };
}
