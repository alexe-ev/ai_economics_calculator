import { describe, it, expect } from "vitest";
import { calculateCascadeRouting } from "./cascade-routing";
import { CascadeRoutingInput } from "@/lib/types";

const baseInput: CascadeRoutingInput = {
  totalRequestsPerMonth: 100000,
  classifierModelId: "claude-haiku",
  classifierCostPerRequest: 0.001,
  tiers: [
    {
      modelId: "haiku",
      trafficPct: 0.6,
      costPerRequest: 0.005,
      qualityScore: 80,
    },
    {
      modelId: "sonnet",
      trafficPct: 0.3,
      costPerRequest: 0.021,
      qualityScore: 92,
    },
    {
      modelId: "opus",
      trafficPct: 0.1,
      costPerRequest: 0.045,
      qualityScore: 98,
    },
  ],
};

describe("calculateCascadeRouting", () => {
  it("calculates classifier cost: 100000 * 0.001 = $100", () => {
    const result = calculateCascadeRouting(baseInput);
    expect(result.classifierCost).toBeCloseTo(100, 2);
  });

  it("calculates tier costs: Haiku=$300, Sonnet=$630, Opus=$450", () => {
    const result = calculateCascadeRouting(baseInput);
    // Haiku: 60000 * 0.005 = 300
    // Sonnet: 30000 * 0.021 = 630
    // Opus: 10000 * 0.045 = 450
    expect(result.tierCosts).toHaveLength(3);
    expect(result.tierCosts[0]).toEqual({
      modelId: "haiku",
      cost: 300,
      volume: 60000,
    });
    expect(result.tierCosts[1]).toEqual({
      modelId: "sonnet",
      cost: 630,
      volume: 30000,
    });
    expect(result.tierCosts[2]).toEqual({
      modelId: "opus",
      cost: 450,
      volume: 10000,
    });
  });

  it("calculates total monthly cost: 100 + 300 + 630 + 450 = $1480", () => {
    const result = calculateCascadeRouting(baseInput);
    expect(result.totalMonthlyCost).toBeCloseTo(1480, 2);
  });

  it("calculates blended cost per request: 1480 / 100000 = $0.0148", () => {
    const result = calculateCascadeRouting(baseInput);
    expect(result.blendedCostPerRequest).toBeCloseTo(0.0148, 4);
  });

  it("calculates blended quality: 0.6*80 + 0.3*92 + 0.1*98 = 85.4", () => {
    const result = calculateCascadeRouting(baseInput);
    // 48 + 27.6 + 9.8 = 85.4
    expect(result.blendedQuality).toBeCloseTo(85.4, 2);
  });

  it("calculates all-expensive cost: 100000 * 0.045 = $4500", () => {
    const result = calculateCascadeRouting(baseInput);
    expect(result.allExpensiveCost).toBeCloseTo(4500, 2);
  });

  it("calculates savings vs expensive: 1 - 1480/4500 ≈ 67.1%", () => {
    const result = calculateCascadeRouting(baseInput);
    // 1 - 1480/4500 = 1 - 0.32888... = 0.67111...
    expect(result.savingsVsExpensive).toBeCloseTo(0.6711, 3);
  });

  it("works with a single tier (100% traffic)", () => {
    const input: CascadeRoutingInput = {
      totalRequestsPerMonth: 50000,
      classifierModelId: "claude-haiku",
      classifierCostPerRequest: 0.001,
      tiers: [
        {
          modelId: "sonnet",
          trafficPct: 1.0,
          costPerRequest: 0.021,
          qualityScore: 92,
        },
      ],
    };
    const result = calculateCascadeRouting(input);
    // classifier: 50000 * 0.001 = 50
    // tier: 50000 * 0.021 = 1050
    // total: 1100
    // blended cost: 1100 / 50000 = 0.022
    // blended quality: 1.0 * 92 = 92
    // all-expensive: 50000 * 0.021 = 1050
    // savings: 1 - 1100/1050 = negative (classifier adds cost)
    expect(result.classifierCost).toBeCloseTo(50, 2);
    expect(result.totalMonthlyCost).toBeCloseTo(1100, 2);
    expect(result.blendedCostPerRequest).toBeCloseTo(0.022, 4);
    expect(result.blendedQuality).toBeCloseTo(92, 2);
    expect(result.allExpensiveCost).toBeCloseTo(1050, 2);
    // Savings is negative because classifier adds overhead with only one tier
    expect(result.savingsVsExpensive).toBeCloseTo(1 - 1100 / 1050, 4);
  });

  it("works with two tiers", () => {
    const input: CascadeRoutingInput = {
      totalRequestsPerMonth: 10000,
      classifierModelId: "claude-haiku",
      classifierCostPerRequest: 0.002,
      tiers: [
        {
          modelId: "haiku",
          trafficPct: 0.7,
          costPerRequest: 0.005,
          qualityScore: 80,
        },
        {
          modelId: "opus",
          trafficPct: 0.3,
          costPerRequest: 0.045,
          qualityScore: 98,
        },
      ],
    };
    const result = calculateCascadeRouting(input);
    // classifier: 10000 * 0.002 = 20
    // haiku: 7000 * 0.005 = 35
    // opus: 3000 * 0.045 = 135
    // total: 20 + 35 + 135 = 190
    // blended cost: 190 / 10000 = 0.019
    // blended quality: 0.7*80 + 0.3*98 = 56 + 29.4 = 85.4
    // all-expensive: 10000 * 0.045 = 450
    // savings: 1 - 190/450 ≈ 0.5778
    expect(result.classifierCost).toBeCloseTo(20, 2);
    expect(result.totalMonthlyCost).toBeCloseTo(190, 2);
    expect(result.blendedCostPerRequest).toBeCloseTo(0.019, 4);
    expect(result.blendedQuality).toBeCloseTo(85.4, 2);
    expect(result.allExpensiveCost).toBeCloseTo(450, 2);
    expect(result.savingsVsExpensive).toBeCloseTo(1 - 190 / 450, 4);
  });

  it("handles zero volume", () => {
    const input: CascadeRoutingInput = {
      totalRequestsPerMonth: 0,
      classifierModelId: "claude-haiku",
      classifierCostPerRequest: 0.001,
      tiers: [
        {
          modelId: "haiku",
          trafficPct: 0.6,
          costPerRequest: 0.005,
          qualityScore: 80,
        },
        {
          modelId: "opus",
          trafficPct: 0.4,
          costPerRequest: 0.045,
          qualityScore: 98,
        },
      ],
    };
    const result = calculateCascadeRouting(input);
    expect(result.classifierCost).toBe(0);
    expect(result.totalMonthlyCost).toBe(0);
    expect(result.blendedCostPerRequest).toBe(0);
    expect(result.allExpensiveCost).toBe(0);
    expect(result.savingsVsExpensive).toBe(0);
  });
});
