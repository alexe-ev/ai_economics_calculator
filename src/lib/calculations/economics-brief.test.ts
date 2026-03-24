import { describe, it, expect } from "vitest";
import { generateEconomicsBrief } from "./economics-brief";
import { EconomicsBriefInput } from "@/lib/types";

const baseInput: EconomicsBriefInput = {
  taskDescription: "Customer support chatbot",
  inputTokens: 1000,
  outputTokens: 500,
  requestsPerDay: 333,
  requestsPerMonth: 10000,
  modelId: "claude-sonnet",
  modelReason: "Best quality/cost",
  costPerRequest: 0,
  monthlyCost: 0,
  humanCostPerUnit: 5.0,
};

describe("generateEconomicsBrief", () => {
  it("should generate brief containing all template lines", () => {
    const result = generateEconomicsBrief(baseInput);
    expect(result.brief).toContain("Task: Customer support chatbot");
    expect(result.brief).toContain("Estimated tokens/request: input");
    expect(result.brief).toContain("Expected volume:");
    expect(result.brief).toContain("Model tier: Claude Sonnet 4.6");
    expect(result.brief).toContain("reason: Best quality/cost");
    expect(result.brief).toContain("Projected cost/request:");
    expect(result.brief).toContain("Projected cost/month:");
    expect(result.brief).toContain("Alternative: human at $5.00/unit");
    expect(result.brief).toContain("Break-even:");
  });

  it("should auto-calculate costPerRequest from model pricing", () => {
    const result = generateEconomicsBrief(baseInput);
    // (1000/1M * 3) + (500/1M * 15) = 0.003 + 0.0075 = 0.0105
    expect(result.brief).toContain("$0.010500");
  });

  it("should calculate monthly cost as costPerRequest * requestsPerMonth", () => {
    const result = generateEconomicsBrief(baseInput);
    // 0.0105 * 10000 = 105
    expect(result.brief).toContain("$105.00");
  });

  it("should return breakEvenVolume = 1 when AI is cheaper than human", () => {
    const result = generateEconomicsBrief(baseInput);
    expect(result.breakEvenVolume).toBe(1);
  });

  it("should calculate aiToHumanRatio correctly", () => {
    const result = generateEconomicsBrief(baseInput);
    // 0.0105 / 5.00 = 0.0021
    expect(result.aiToHumanRatio).toBeCloseTo(0.0021, 4);
  });

  it("should use manual costPerRequest when provided and different from calculated", () => {
    const input: EconomicsBriefInput = {
      ...baseInput,
      costPerRequest: 0.05,
    };
    const result = generateEconomicsBrief(input);
    expect(result.brief).toContain("$0.050000");
    // monthly: 0.05 * 10000 = 500
    expect(result.brief).toContain("$500.00");
  });

  it("should count unknown fields when taskDescription and modelReason are empty", () => {
    const input: EconomicsBriefInput = {
      ...baseInput,
      taskDescription: "",
      modelReason: "",
    };
    const result = generateEconomicsBrief(input);
    expect(result.unknownFieldsCount).toBe(2);
  });

  it("should count all empty/zero fields", () => {
    const input: EconomicsBriefInput = {
      taskDescription: "",
      inputTokens: 0,
      outputTokens: 0,
      requestsPerDay: 0,
      requestsPerMonth: 0,
      modelId: "",
      modelReason: "",
      costPerRequest: 0,
      monthlyCost: 0,
      humanCostPerUnit: 0,
    };
    const result = generateEconomicsBrief(input);
    // fields checked: taskDescription(""), inputTokens(0), outputTokens(0),
    // requestsPerDay(0), requestsPerMonth(0), modelId(""), modelReason(""), humanCostPerUnit(0)
    expect(result.unknownFieldsCount).toBe(8);
  });

  it("should report break-even never when AI costs more than human", () => {
    const input: EconomicsBriefInput = {
      ...baseInput,
      humanCostPerUnit: 0.001,
    };
    const result = generateEconomicsBrief(input);
    expect(result.breakEvenVolume).toBe(0);
    expect(result.brief).toContain("AI is more expensive per request");
  });

  it("should format each brief line correctly", () => {
    const result = generateEconomicsBrief(baseInput);
    const lines = result.brief.split("\n");
    expect(lines[0]).toBe("Task: Customer support chatbot");
    expect(lines[1]).toContain("input 1,000 + output 500");
    expect(lines[2]).toContain("333 /day");
    expect(lines[2]).toContain("10,000 /month");
    expect(lines[3]).toContain("Claude Sonnet 4.6");
    expect(lines[4]).toContain("1,000/1M × $3");
    expect(lines[4]).toContain("500/1M × $15");
    expect(lines[5]).toContain("$0.010500 × 10,000 = $105.00");
    expect(lines[6]).toBe("Alternative: human at $5.00/unit");
    expect(lines[7]).toContain("AI is cheaper from request #1");
    expect(lines[7]).toContain("0.2% of human cost");
  });

  it("should handle unknown model with $0 costs", () => {
    const input: EconomicsBriefInput = {
      ...baseInput,
      modelId: "nonexistent-model",
    };
    const result = generateEconomicsBrief(input);
    expect(result.brief).toContain("Model tier: nonexistent-model");
    expect(result.brief).toContain("$0.000000");
    expect(result.breakEvenVolume).toBe(0);
    expect(result.aiToHumanRatio).toBe(0);
    expect(result.brief).toContain("Break-even: insufficient data");
  });
});
