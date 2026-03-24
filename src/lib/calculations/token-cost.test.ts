import { describe, it, expect } from "vitest";
import {
  calculateTokenCost,
  calculateModelComparison,
  calculateForModel,
} from "./token-cost";
import type { TokenCostInput } from "@/lib/types";

function makeInput(overrides: Partial<TokenCostInput> = {}): TokenCostInput {
  return {
    inputTokens: 1000,
    outputTokens: 500,
    modelId: "claude-sonnet",
    language: "en",
    batchApi: false,
    promptCaching: false,
    cacheHitRate: 0,
    cachedTokens: 0,
    extendedThinking: false,
    thinkingTokens: 0,
    requestsPerMonth: 10000,
    ...overrides,
  };
}

describe("calculateTokenCost", () => {
  it("calculates base cost correctly", () => {
    // claude-sonnet: input=$3/MTok, output=$15/MTok
    // inputCost  = 1000 / 1_000_000 * 3  = 0.003
    // outputCost = 500  / 1_000_000 * 15 = 0.0075
    // total = 0.0105
    const result = calculateTokenCost(makeInput());

    expect(result.inputCost).toBeCloseTo(0.003, 6);
    expect(result.outputCost).toBeCloseTo(0.0075, 6);
    expect(result.costPerRequest).toBeCloseTo(0.0105, 6);
    expect(result.thinkingCost).toBeCloseTo(0, 6);
  });

  it("applies language multiplier for Chinese (zh = 2.0x)", () => {
    // adjInput  = 1000 * 2.0 = 2000
    // adjOutput = 500  * 2.0 = 1000
    // inputCost  = 2000 / 1_000_000 * 3  = 0.006
    // outputCost = 1000 / 1_000_000 * 15 = 0.015
    // total = 0.021
    const result = calculateTokenCost(makeInput({ language: "zh" }));

    expect(result.inputCost).toBeCloseTo(0.006, 6);
    expect(result.outputCost).toBeCloseTo(0.015, 6);
    expect(result.costPerRequest).toBeCloseTo(0.021, 6);
  });

  it("applies 50% batch API discount", () => {
    // base cost = 0.0105 (see test 1)
    // batch discount: all costs * 0.5
    // costPerRequest = 0.00525
    // inputCost  = 0.003  * 0.5 = 0.0015
    // outputCost = 0.0075 * 0.5 = 0.00375
    const result = calculateTokenCost(makeInput({ batchApi: true }));

    expect(result.costPerRequest).toBeCloseTo(0.00525, 6);
    expect(result.inputCost).toBeCloseTo(0.0015, 6);
    expect(result.outputCost).toBeCloseTo(0.00375, 6);
  });

  it("calculates prompt caching with blended hit/miss cost", () => {
    // inputTokens=1000, cachedTokens=800, cacheHitRate=0.8
    // claude-sonnet: input=$3/MTok, output=$15/MTok
    //
    // Cache HIT path (input cost):
    //   cachedInputCost   = (800 / 1M) * 3 * 0.1 = 0.00024
    //   uncachedInputCost = (200 / 1M) * 3        = 0.0006
    //   hitInputCost = 0.00024 + 0.0006 = 0.00084
    //
    // Cache MISS path (full input cost):
    //   fullInputCost = (1000 / 1M) * 3 = 0.003
    //
    // Blended inputCost = 0.8 * 0.00084 + 0.2 * 0.003
    //                   = 0.000672 + 0.0006
    //                   = 0.001272
    //
    // outputCost = (500 / 1M) * 15 = 0.0075
    // costPerRequest = 0.001272 + 0.0075 = 0.008772
    const result = calculateTokenCost(
      makeInput({
        promptCaching: true,
        cachedTokens: 800,
        cacheHitRate: 0.8,
      })
    );

    expect(result.inputCost).toBeCloseTo(0.001272, 6);
    expect(result.outputCost).toBeCloseTo(0.0075, 6);
    expect(result.costPerRequest).toBeCloseTo(0.008772, 6);
  });

  it("calculates extended thinking tokens priced as output", () => {
    // inputTokens=1000, outputTokens=500, thinkingTokens=300
    // claude-sonnet: input=$3/MTok, output=$15/MTok
    //
    // inputCost    = (1000 / 1M) * 3  = 0.003
    // outputCost   = (500  / 1M) * 15 = 0.0075
    // thinkingCost = (300  / 1M) * 15 = 0.0045
    // costPerRequest = 0.003 + 0.0075 + 0.0045 = 0.015
    const result = calculateTokenCost(
      makeInput({
        extendedThinking: true,
        thinkingTokens: 300,
      })
    );

    expect(result.inputCost).toBeCloseTo(0.003, 6);
    expect(result.outputCost).toBeCloseTo(0.0075, 6);
    expect(result.thinkingCost).toBeCloseTo(0.0045, 6);
    expect(result.costPerRequest).toBeCloseTo(0.015, 6);
  });

  it("calculates monthly cost as costPerRequest * requestsPerMonth", () => {
    // costPerRequest = 0.0105, requestsPerMonth = 10000
    // monthlyCost = 0.0105 * 10000 = 105
    const result = calculateTokenCost(makeInput({ requestsPerMonth: 10000 }));

    expect(result.monthlyCost).toBeCloseTo(105, 6);
  });

  it("calculates output share as outputCost / totalTokenCost", () => {
    // inputCost = 0.003, outputCost = 0.0075, thinkingCost = 0
    // outputSharePct = 0.0075 / (0.003 + 0.0075 + 0) = 0.0075 / 0.0105
    //               = 0.714285...
    const result = calculateTokenCost(makeInput());

    expect(result.outputSharePct).toBeCloseTo(0.0075 / 0.0105, 6);
  });

  it("calculates MRR share as monthlyCost / mrrForIndicator", () => {
    // monthlyCost = 105 (from costPerRequest=0.0105 * 10000)
    // mrrForIndicator = 5000
    // mrrSharePct = 105 / 5000 = 0.021
    const result = calculateTokenCost(
      makeInput({ requestsPerMonth: 10000, mrrForIndicator: 5000 })
    );

    expect(result.mrrSharePct).toBeCloseTo(0.021, 6);
  });

  it("returns all 9 models sorted by cost ascending in model comparison", () => {
    const result = calculateTokenCost(makeInput());

    expect(result.modelComparison).toHaveLength(9);

    // Verify sorted ascending by costPerRequest
    for (let i = 1; i < result.modelComparison.length; i++) {
      expect(result.modelComparison[i].costPerRequest).toBeGreaterThanOrEqual(
        result.modelComparison[i - 1].costPerRequest
      );
    }

    // Cheapest should be gemini-flash-lite: (1000/1M)*0.1 + (500/1M)*0.4 = 0.0001 + 0.0002 = 0.0003
    expect(result.modelComparison[0].modelId).toBe("gemini-flash-lite");
    expect(result.modelComparison[0].costPerRequest).toBeCloseTo(0.0003, 6);

    // Most expensive should be claude-opus: (1000/1M)*5 + (500/1M)*25 = 0.005 + 0.0125 = 0.0175
    expect(result.modelComparison[8].modelId).toBe("claude-opus");
    expect(result.modelComparison[8].costPerRequest).toBeCloseTo(0.0175, 6);
  });

  it("returns zeros for unknown model", () => {
    const result = calculateTokenCost(makeInput({ modelId: "nonexistent" }));

    expect(result.costPerRequest).toBe(0);
    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.thinkingCost).toBe(0);
    expect(result.monthlyCost).toBe(0);
    expect(result.outputSharePct).toBe(0);
    expect(result.modelComparison).toHaveLength(0);
  });

  it("handles 0 tokens", () => {
    const result = calculateTokenCost(
      makeInput({ inputTokens: 0, outputTokens: 0 })
    );

    expect(result.costPerRequest).toBe(0);
    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.monthlyCost).toBe(0);
    expect(result.outputSharePct).toBe(0);
  });

  it("handles 0 requests per month", () => {
    const result = calculateTokenCost(makeInput({ requestsPerMonth: 0 }));

    // costPerRequest is still computed normally
    expect(result.costPerRequest).toBeCloseTo(0.0105, 6);
    expect(result.monthlyCost).toBe(0);
  });
});

describe("calculateForModel", () => {
  it("returns cost for a specific model with language multiplier", () => {
    // claude-sonnet, 1000 input, 500 output, language "zh" (2.0x)
    // adjInput  = 1000 * 2.0 = 2000
    // adjOutput = 500  * 2.0 = 1000
    // cost = (2000/1M)*3 + (1000/1M)*15 = 0.006 + 0.015 = 0.021
    // monthlyCost = 0.021 * 10000 = 210
    const result = calculateForModel("claude-sonnet", 1000, 500, "zh");

    expect(result.costPerRequest).toBeCloseTo(0.021, 6);
    expect(result.monthlyCost).toBeCloseTo(210, 6);
  });

  it("returns zeros for unknown model", () => {
    const result = calculateForModel("nonexistent", 1000, 500, "en");

    expect(result.costPerRequest).toBe(0);
    expect(result.monthlyCost).toBe(0);
  });
});

describe("calculateModelComparison", () => {
  it("returns comparison array from calculateTokenCost", () => {
    const comparison = calculateModelComparison(makeInput());

    expect(comparison).toHaveLength(9);
    expect(comparison[0].costPerRequest).toBeLessThanOrEqual(
      comparison[comparison.length - 1].costPerRequest
    );
  });
});
