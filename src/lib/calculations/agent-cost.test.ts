import { describe, it, expect } from "vitest";
import { calculateAgentCost } from "./agent-cost";
import { AgentCostInput } from "@/lib/types";

// All tests use claude-sonnet: inputPricePerMTok=3, outputPricePerMTok=15

const DEFAULT_TOOL_DEFS = {
  numTools: 0,
  avgToolDefSize: 0,
  systemOverhead: 0,
};

describe("calculateAgentCost", () => {
  // 1. Single step, no tools
  it("calculates cost for single step without tools", () => {
    // inputCost = 1000 / 1_000_000 * 3 = 0.003
    // outputCost = 500 / 1_000_000 * 15 = 0.0075
    // totalCost = 0.003 + 0.0075 = 0.0105
    // retryRate = 0 => costPerIntent = 0.0105 * (1 + 0) = 0.0105
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].contextSize).toBe(1000);
    expect(result.steps[0].effectiveInput).toBe(1000);
    expect(result.steps[0].inputCost).toBeCloseTo(0.003, 6);
    expect(result.steps[0].outputCost).toBeCloseTo(0.0075, 6);
    expect(result.steps[0].totalCost).toBeCloseTo(0.0105, 6);
    expect(result.costPerIntent).toBeCloseTo(0.0105, 6);
  });

  // 2. Context accumulation across 3 steps
  it("accumulates context across multiple steps", () => {
    // Step 1: context = 1000, input cost = 1000/1M*3 = 0.003, output = 500/1M*15 = 0.0075
    // Step 2: context = 1000 + 500 + 200 = 1700, input cost = 1700/1M*3 = 0.0051, output = 300/1M*15 = 0.0045
    // Step 3: context = 1700 + 300 + 100 = 2100, input cost = 2100/1M*3 = 0.0063, output = 200/1M*15 = 0.003
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
        {
          newInputTokens: 200,
          outputTokens: 300,
          modelId: "claude-sonnet",
          toolUse: false,
        },
        {
          newInputTokens: 100,
          outputTokens: 200,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.steps).toHaveLength(3);

    // Step 1
    expect(result.steps[0].contextSize).toBe(1000);
    expect(result.steps[0].inputCost).toBeCloseTo(0.003, 6);
    expect(result.steps[0].outputCost).toBeCloseTo(0.0075, 6);

    // Step 2: context = 1000 + 500 + 200 = 1700
    expect(result.steps[1].contextSize).toBe(1700);
    expect(result.steps[1].inputCost).toBeCloseTo(0.0051, 6);
    expect(result.steps[1].outputCost).toBeCloseTo(0.0045, 6);

    // Step 3: context = 1700 + 300 + 100 = 2100
    expect(result.steps[2].contextSize).toBe(2100);
    expect(result.steps[2].inputCost).toBeCloseTo(0.0063, 6);
    expect(result.steps[2].outputCost).toBeCloseTo(0.003, 6);

    expect(result.totalContextTokens).toBe(2100);
  });

  // 3. Tool overhead
  it("adds tool overhead to effective input for tool-using steps", () => {
    // toolOverhead = 500 + 5*200 = 1500
    // Step has 1000 input tokens, toolUse=true
    // effectiveInput = 1000 + 1500 = 2500
    // inputCost = 2500/1M*3 = 0.0075
    // outputCost = 500/1M*15 = 0.0075
    // totalCost = 0.015
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: true,
        },
      ],
      toolDefinitions: {
        numTools: 5,
        avgToolDefSize: 200,
        systemOverhead: 500,
      },
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.steps[0].contextSize).toBe(1000);
    expect(result.steps[0].effectiveInput).toBe(2500);
    expect(result.steps[0].inputCost).toBeCloseTo(0.0075, 6);
    expect(result.steps[0].outputCost).toBeCloseTo(0.0075, 6);
    expect(result.steps[0].totalCost).toBeCloseTo(0.015, 6);
  });

  // 4. Tool result tokens added to context
  it("includes tool result tokens in next step context", () => {
    // Step 1: context = 1000, toolUse=true, toolResultTokens=800, output=500
    // Step 2: context = 1000 + 500 + 800 + 200 = 2500
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: true,
          toolResultTokens: 800,
        },
        {
          newInputTokens: 200,
          outputTokens: 300,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    // Step 2 context: 1000 (prev context) + 500 (prev output) + 800 (prev toolResult) + 200 (new input) = 2500
    expect(result.steps[1].contextSize).toBe(2500);
  });

  // 5. Retry rate adds to costPerIntent
  it("applies retry rate to cost per intent", () => {
    // baseCost = (1000/1M*3) + (500/1M*15) = 0.003 + 0.0075 = 0.0105
    // costPerIntent = 0.0105 * (1 + 0.10) = 0.01155
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0.1,
    };

    const result = calculateAgentCost(input);

    expect(result.costPerIntent).toBeCloseTo(0.01155, 6);
  });

  // 6. Success rate: costPerOutcome = costPerIntent / successRate
  it("calculates cost per outcome using success rate", () => {
    // baseCost = 0.0105, retryRate = 0 => costPerIntent = 0.0105
    // costPerOutcome = 0.0105 / 0.85 = 0.01235294...
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 0.85,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.costPerIntent).toBeCloseTo(0.0105, 6);
    // 0.0105 / 0.85 = 0.012352941...
    expect(result.costPerOutcome).toBeCloseTo(0.0105 / 0.85, 6);
    expect(result.costPerOutcome).toBeGreaterThan(result.costPerIntent);
  });

  // 7. Multiplier vs baseline
  it("computes multiplier as costPerIntent / firstStepCost", () => {
    // Step 1 cost = (1000/1M*3) + (500/1M*15) = 0.0105
    // Step 2 context = 1000+500+200 = 1700, cost = (1700/1M*3) + (300/1M*15) = 0.0051 + 0.0045 = 0.0096
    // baseCost = 0.0105 + 0.0096 = 0.0201
    // costPerIntent (retryRate=0) = 0.0201
    // singleCallBaseline = 0.0105
    // multiplier = 0.0201 / 0.0105 = 1.914285...
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
        {
          newInputTokens: 200,
          outputTokens: 300,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.singleCallBaseline).toBeCloseTo(0.0105, 6);
    // multiplier = costPerIntent / singleCallBaseline = 0.0201 / 0.0105
    expect(result.multiplierVsBaseline).toBeCloseTo(0.0201 / 0.0105, 4);
  });

  // 8. Multi-agent mode
  it("adds orchestrator cost and communication overhead in multi-agent mode", () => {
    // Single step: baseCost = 0.0105, retryRate=0 => costPerIntent before multi-agent = 0.0105
    //
    // Orchestrator: claude-sonnet (inputPrice=3), orchestratorCostPerCall = 0.005
    // numSpecialists = 2, handoffTokens = 500
    // communicationOverhead = (2 * 500) / 1_000_000 * 3 * 2 = 1000 / 1_000_000 * 6 = 0.006
    // multiAgentOverhead = 0.005 + 0.006 = 0.011
    // totalCostWithMultiAgent = 0.0105 + 0.011 = 0.0215
    // costPerIntent = totalCostWithMultiAgent = 0.0215
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "multi-agent",
      multiAgent: {
        numSpecialists: 2,
        orchestratorModelId: "claude-sonnet",
        orchestratorCostPerCall: 0.005,
        handoffTokens: 500,
      },
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    // communicationOverhead = (2 * 500 / 1M) * 3 * 2 = 0.006
    expect(result.multiAgentOverhead).toBeCloseTo(0.011, 6);
    expect(result.costPerIntent).toBeCloseTo(0.0215, 6);
    expect(result.multiAgentOverheadPct).toBeCloseTo(0.011 / 0.0215, 4);
  });

  // 9. Empty steps
  it("returns zeros for empty steps array", () => {
    const input: AgentCostInput = {
      steps: [],
      toolDefinitions: DEFAULT_TOOL_DEFS,
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.steps).toHaveLength(0);
    expect(result.costPerIntent).toBe(0);
    expect(result.costPerOutcome).toBe(0);
    expect(result.singleCallBaseline).toBe(0);
    expect(result.multiplierVsBaseline).toBe(1);
    expect(result.toolOverheadTotal).toBe(0);
    expect(result.toolOverheadPct).toBe(0);
    expect(result.totalContextTokens).toBe(0);
  });

  // 10. Tool overhead percentage
  it("calculates tool overhead percentage correctly", () => {
    // toolOverhead = 500 + 5*200 = 1500 tokens
    //
    // Step 1 (toolUse=true): context=1000, effectiveInput=1000+1500=2500
    //   inputCost = 2500/1M*3 = 0.0075, outputCost = 500/1M*15 = 0.0075, total = 0.015
    //   toolOverheadCost for this step = 1500/1M*3 = 0.0045
    //
    // Step 2 (toolUse=false): context = 1000+500+200 = 1700, effectiveInput=1700
    //   inputCost = 1700/1M*3 = 0.0051, outputCost = 300/1M*15 = 0.0045, total = 0.0096
    //   no tool overhead
    //
    // baseCostPerIntent = 0.015 + 0.0096 = 0.0246
    // totalToolOverheadCost = 0.0045
    // toolOverheadPct = 0.0045 / 0.0246 = 0.18292682...
    const input: AgentCostInput = {
      steps: [
        {
          newInputTokens: 1000,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: true,
        },
        {
          newInputTokens: 200,
          outputTokens: 300,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
      toolDefinitions: {
        numTools: 5,
        avgToolDefSize: 200,
        systemOverhead: 500,
      },
      mode: "single-agent",
      successRate: 1.0,
      retryRate: 0,
    };

    const result = calculateAgentCost(input);

    expect(result.toolOverheadTotal).toBeCloseTo(0.0045, 6);
    // toolOverheadPct = 0.0045 / 0.0246
    expect(result.toolOverheadPct).toBeCloseTo(0.0045 / 0.0246, 4);
  });
});
