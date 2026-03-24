import { describe, it, expect } from "vitest";
import { calculateOptimizationStack } from "./optimization-stack";
import { OptimizationInput } from "@/lib/types";

// Baseline: inputTokens=2000, outputTokens=1000, inputPrice=3, outputPrice=15, requests=100000
// baselineCostPerRequest = (2000/1M)*3 + (1000/1M)*15 = 0.006 + 0.015 = 0.021
// baselineMonthlyCost = 0.021 * 100000 = 2100

const baseInput: OptimizationInput = {
  inputTokens: 2000,
  outputTokens: 1000,
  inputPricePerMTok: 3,
  outputPricePerMTok: 15,
  requestsPerMonth: 100_000,
  outputLimitsEnabled: false,
  newOutputTokens: 1000,
  promptCachingEnabled: false,
  cachedPrefixTokens: 0,
  cacheHitRate: 0,
  semanticCacheEnabled: false,
  faqTrafficShare: 0,
  semanticHitRate: 0,
  contextMgmtEnabled: false,
  contextReductionPct: 0,
};

describe("calculateOptimizationStack", () => {
  it("all layers disabled: output equals baseline, 0 savings, 4 layers with savingsPct=0", () => {
    const result = calculateOptimizationStack({ ...baseInput });

    expect(result.layers).toHaveLength(4);
    expect(result.baselineMonthlyCost).toBeCloseTo(2100, 2);
    expect(result.finalMonthlyCost).toBeCloseTo(2100, 2);
    expect(result.cumulativeSavingsPct).toBeCloseTo(0, 5);

    for (const layer of result.layers) {
      expect(layer.savingsPct).toBeCloseTo(0, 5);
      expect(layer.costPerRequest).toBeCloseTo(0.021, 6);
      expect(layer.monthlyCost).toBeCloseTo(2100, 2);
    }
  });

  it("Layer 1 only (Output Limits): newOutputTokens=500", () => {
    // cost = (2000/1M)*3 + (500/1M)*15 = 0.006 + 0.0075 = 0.0135
    // savingsPct = 1 - 0.0135/0.021 = 1 - 0.642857... ≈ 0.35714
    const result = calculateOptimizationStack({
      ...baseInput,
      outputLimitsEnabled: true,
      newOutputTokens: 500,
    });

    expect(result.layers).toHaveLength(4);

    const layer1 = result.layers[0];
    expect(layer1.name).toBe("Output Limits");
    expect(layer1.costPerRequest).toBeCloseTo(0.0135, 6);
    expect(layer1.monthlyCost).toBeCloseTo(1350, 2);
    expect(layer1.savingsPct).toBeCloseTo(1 - 0.0135 / 0.021, 4); // ≈ 0.35714
    expect(layer1.cumulativeSavingsPct).toBeCloseTo(1 - 0.0135 / 0.021, 4);

    // Remaining layers pass through unchanged
    for (let i = 1; i < 4; i++) {
      expect(result.layers[i].savingsPct).toBeCloseTo(0, 5);
      expect(result.layers[i].costPerRequest).toBeCloseTo(0.0135, 6);
    }

    expect(result.finalMonthlyCost).toBeCloseTo(1350, 2);
    expect(result.cumulativeSavingsPct).toBeCloseTo(1 - 1350 / 2100, 4);
  });

  it("Layer 2 only (Prompt Caching): cachedPrefixTokens=1500, cacheHitRate=0.8", () => {
    // currentInputTokens=2000, currentOutputTokens=1000 (layer1 disabled)
    // cachedPrefix = min(1500, 2000) = 1500
    // cacheHit cost = (1500/1M)*3*0.1 + (500/1M)*3 + (1000/1M)*15
    //              = 0.00045 + 0.0015 + 0.015 = 0.01695
    // cacheMiss cost = 0.021 (baseline, layer1 didn't change it)
    // blended = 0.8*0.01695 + 0.2*0.021 = 0.01356 + 0.0042 = 0.01776
    // layerSavings = 1 - 0.01776/0.021 ≈ 0.15429
    const result = calculateOptimizationStack({
      ...baseInput,
      promptCachingEnabled: true,
      cachedPrefixTokens: 1500,
      cacheHitRate: 0.8,
    });

    expect(result.layers).toHaveLength(4);

    // Layer 1 disabled, passthrough
    expect(result.layers[0].savingsPct).toBeCloseTo(0, 5);

    const layer2 = result.layers[1];
    expect(layer2.name).toBe("Prompt Caching");
    expect(layer2.costPerRequest).toBeCloseTo(0.01776, 5);
    expect(layer2.monthlyCost).toBeCloseTo(1776, 1);
    expect(layer2.savingsPct).toBeCloseTo(1 - 0.01776 / 0.021, 4);
    expect(layer2.cumulativeSavingsPct).toBeCloseTo(1 - 0.01776 / 0.021, 4);

    expect(result.finalMonthlyCost).toBeCloseTo(1776, 1);
    expect(result.cumulativeSavingsPct).toBeCloseTo(1 - 1776 / 2100, 4);
  });

  it("Layer 3 only (Semantic Cache): faqTrafficShare=0.3, semanticHitRate=0.67", () => {
    // deflectionRate = 0.3 * 0.67 = 0.201
    // costAfterSemantic = (1 - 0.201) * 0.021 = 0.799 * 0.021 = 0.016779
    // layerSavings = 1 - 0.016779/0.021 = 0.201
    const result = calculateOptimizationStack({
      ...baseInput,
      semanticCacheEnabled: true,
      faqTrafficShare: 0.3,
      semanticHitRate: 0.67,
    });

    expect(result.layers).toHaveLength(4);

    const layer3 = result.layers[2];
    expect(layer3.name).toBe("Semantic Cache");
    expect(layer3.costPerRequest).toBeCloseTo(0.021 * 0.799, 6);
    expect(layer3.savingsPct).toBeCloseTo(0.201, 4);
    expect(layer3.cumulativeSavingsPct).toBeCloseTo(0.201, 4);

    const expectedMonthly = 0.021 * 0.799 * 100_000;
    expect(result.finalMonthlyCost).toBeCloseTo(expectedMonthly, 1);
    expect(result.cumulativeSavingsPct).toBeCloseTo(0.201, 4);
  });

  it("Layer 4 only (Context Management): contextReductionPct=0.5", () => {
    // currentInputTokens=2000, currentOutputTokens=1000, currentCostPerRequest=0.021
    // reducedInput = 2000 * (1 - 0.5) = 1000
    // costAfterContext = (1000/1M)*3 + (1000/1M)*15 = 0.003 + 0.015 = 0.018
    // contextSavingsRatio = costAfterContext / ((2000/1M)*3 + (1000/1M)*15) = 0.018 / 0.021
    // costAfterAll = 0.021 * (0.018/0.021) = 0.018
    // layerSavings = 1 - 0.018/0.021 ≈ 0.142857
    const result = calculateOptimizationStack({
      ...baseInput,
      contextMgmtEnabled: true,
      contextReductionPct: 0.5,
    });

    expect(result.layers).toHaveLength(4);

    const layer4 = result.layers[3];
    expect(layer4.name).toBe("Context Management");
    expect(layer4.costPerRequest).toBeCloseTo(0.018, 6);
    expect(layer4.monthlyCost).toBeCloseTo(1800, 1);
    expect(layer4.savingsPct).toBeCloseTo(1 - 0.018 / 0.021, 4); // ≈ 0.14286
    expect(layer4.cumulativeSavingsPct).toBeCloseTo(1 - 0.018 / 0.021, 4);

    expect(result.finalMonthlyCost).toBeCloseTo(1800, 1);
    expect(result.cumulativeSavingsPct).toBeCloseTo(1 - 1800 / 2100, 4);
  });

  it("All 4 layers enabled: cumulative pipeline", () => {
    // Layer 1: Output Limits, newOutputTokens=500
    //   currentOutputTokens = 500, currentInputTokens = 2000
    //   cost = (2000/1M)*3 + (500/1M)*15 = 0.006 + 0.0075 = 0.0135
    //
    // Layer 2: Prompt Caching, cachedPrefixTokens=1500, cacheHitRate=0.8
    //   cachedPrefix = min(1500, 2000) = 1500
    //   cacheHit = (1500/1M)*3*0.1 + (500/1M)*3 + (500/1M)*15
    //            = 0.00045 + 0.0015 + 0.0075 = 0.00945
    //   cacheMiss = 0.0135
    //   blended = 0.8*0.00945 + 0.2*0.0135 = 0.00756 + 0.0027 = 0.01026
    //
    // Layer 3: Semantic Cache, faqTrafficShare=0.3, semanticHitRate=0.67
    //   deflection = 0.3*0.67 = 0.201
    //   cost = (1 - 0.201) * 0.01026 = 0.799 * 0.01026 = 0.00819774
    //
    // Layer 4: Context Management, contextReductionPct=0.5
    //   currentInputTokens=2000, currentOutputTokens=500
    //   reducedInput = 2000 * 0.5 = 1000
    //   costAfterContext = (1000/1M)*3 + (500/1M)*15 = 0.003 + 0.0075 = 0.0105
    //   denominator = (2000/1M)*3 + (500/1M)*15 = 0.006 + 0.0075 = 0.0135
    //   contextSavingsRatio = 0.0105 / 0.0135 = 0.77778
    //   costAfterAll = 0.00819774 * 0.77778 ≈ 0.006376
    const result = calculateOptimizationStack({
      ...baseInput,
      outputLimitsEnabled: true,
      newOutputTokens: 500,
      promptCachingEnabled: true,
      cachedPrefixTokens: 1500,
      cacheHitRate: 0.8,
      semanticCacheEnabled: true,
      faqTrafficShare: 0.3,
      semanticHitRate: 0.67,
      contextMgmtEnabled: true,
      contextReductionPct: 0.5,
    });

    expect(result.layers).toHaveLength(4);

    // Layer 1
    expect(result.layers[0].costPerRequest).toBeCloseTo(0.0135, 5);
    expect(result.layers[0].savingsPct).toBeCloseTo(1 - 0.0135 / 0.021, 4);

    // Layer 2
    expect(result.layers[1].costPerRequest).toBeCloseTo(0.01026, 5);
    expect(result.layers[1].savingsPct).toBeCloseTo(1 - 0.01026 / 0.0135, 3);

    // Layer 3
    const layer3Cost = 0.799 * 0.01026;
    expect(result.layers[2].costPerRequest).toBeCloseTo(layer3Cost, 5);
    expect(result.layers[2].savingsPct).toBeCloseTo(0.201, 3);

    // Layer 4
    const contextRatio = 0.0105 / 0.0135; // ≈ 0.77778
    const finalCost = layer3Cost * contextRatio;
    expect(result.layers[3].costPerRequest).toBeCloseTo(finalCost, 5);
    expect(result.layers[3].savingsPct).toBeCloseTo(1 - contextRatio, 3);
    expect(result.layers[3].cumulativeSavingsPct).toBeCloseTo(1 - finalCost / 0.021, 3);

    // Final
    expect(result.baselineMonthlyCost).toBeCloseTo(2100, 2);
    expect(result.finalMonthlyCost).toBeCloseTo(finalCost * 100_000, 0);
    expect(result.cumulativeSavingsPct).toBeCloseTo(1 - finalCost / 0.021, 3);
  });

  it("cumulative savings: final monthly vs baseline monthly", () => {
    // Enable layers 1 and 3 to verify cumulative math
    // Layer 1: newOutputTokens=500 -> cost=0.0135
    // Layer 3: deflection=0.3*0.67=0.201 -> cost=0.0135*0.799=0.0107865
    const result = calculateOptimizationStack({
      ...baseInput,
      outputLimitsEnabled: true,
      newOutputTokens: 500,
      semanticCacheEnabled: true,
      faqTrafficShare: 0.3,
      semanticHitRate: 0.67,
    });

    const expectedFinal = 0.0135 * 0.799;
    const expectedMonthly = expectedFinal * 100_000;
    expect(result.finalMonthlyCost).toBeCloseTo(expectedMonthly, 1);
    expect(result.baselineMonthlyCost).toBeCloseTo(2100, 2);
    expect(result.cumulativeSavingsPct).toBeCloseTo(1 - expectedMonthly / 2100, 4);

    // Also verify final layer's cumulativeSavingsPct matches the top-level one
    const lastLayer = result.layers[result.layers.length - 1];
    expect(lastLayer.cumulativeSavingsPct).toBeCloseTo(result.cumulativeSavingsPct, 5);
  });

  it("always 4 layers in output, even if all disabled", () => {
    const result = calculateOptimizationStack({ ...baseInput });

    expect(result.layers).toHaveLength(4);
    expect(result.layers[0].name).toBe("Output Limits");
    expect(result.layers[1].name).toBe("Prompt Caching");
    expect(result.layers[2].name).toBe("Semantic Cache");
    expect(result.layers[3].name).toBe("Context Management");
  });

  it("edge case: 0 tokens, 0 requests", () => {
    const result = calculateOptimizationStack({
      ...baseInput,
      inputTokens: 0,
      outputTokens: 0,
      requestsPerMonth: 0,
    });

    expect(result.layers).toHaveLength(4);
    expect(result.baselineMonthlyCost).toBe(0);
    expect(result.finalMonthlyCost).toBe(0);
    expect(result.cumulativeSavingsPct).toBe(0);

    for (const layer of result.layers) {
      expect(layer.costPerRequest).toBe(0);
      expect(layer.monthlyCost).toBe(0);
      expect(layer.savingsPct).toBe(0);
      expect(layer.cumulativeSavingsPct).toBe(0);
    }
  });
});
