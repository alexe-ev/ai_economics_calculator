import { AgentCostInput, AgentCostOutput, AgentStepCost } from "@/lib/types";
import { getModel } from "@/lib/data/models";

export function calculateAgentCost(input: AgentCostInput): AgentCostOutput {
  const { steps, toolDefinitions, mode, multiAgent, successRate, retryRate } = input;

  if (steps.length === 0) {
    return {
      steps: [],
      costPerIntent: 0,
      costPerOutcome: 0,
      singleCallBaseline: 0,
      multiplierVsBaseline: 1,
      toolOverheadTotal: 0,
      toolOverheadPct: 0,
      totalContextTokens: 0,
    };
  }

  // Tool definition overhead: system prompt + (num_tools * avg_tool_def_size)
  const toolOverheadTokens =
    toolDefinitions.systemOverhead +
    toolDefinitions.numTools * toolDefinitions.avgToolDefSize;

  const stepCosts: AgentStepCost[] = [];
  let totalToolOverheadCost = 0;

  // Context accumulates across steps
  // context[0] = step[0].newInputTokens
  // context[i] = context[i-1] + output[i-1] + toolResult[i-1] + newInput[i]
  let contextSize = steps[0].newInputTokens;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const model = getModel(step.modelId);
    const inputPrice = model?.inputPricePerMTok ?? 0;
    const outputPrice = model?.outputPricePerMTok ?? 0;

    if (i > 0) {
      const prev = steps[i - 1];
      contextSize +=
        prev.outputTokens +
        (prev.toolUse ? (prev.toolResultTokens ?? 0) : 0) +
        step.newInputTokens;
    }

    // Effective input includes tool overhead if step uses tools
    const effectiveInput = step.toolUse
      ? contextSize + toolOverheadTokens
      : contextSize;

    const inputCost = (effectiveInput / 1_000_000) * inputPrice;
    const outputCost = (step.outputTokens / 1_000_000) * outputPrice;
    const totalCost = inputCost + outputCost;

    // Track tool overhead cost for this step
    if (step.toolUse) {
      totalToolOverheadCost += (toolOverheadTokens / 1_000_000) * inputPrice;
    }

    stepCosts.push({
      step: i + 1,
      contextSize,
      effectiveInput,
      inputCost,
      outputCost,
      totalCost,
    });
  }

  // Cost per intent (sum of all step costs)
  const baseCostPerIntent = stepCosts.reduce((sum, s) => sum + s.totalCost, 0);

  // Account for retry rate: some intents need to be run again
  const costPerIntent = baseCostPerIntent * (1 + retryRate);

  // Single call baseline: first step cost only
  const singleCallBaseline = stepCosts[0].totalCost;

  // Tool overhead percentage
  const toolOverheadPct =
    baseCostPerIntent > 0 ? totalToolOverheadCost / baseCostPerIntent : 0;

  // Multi-agent overhead
  let multiAgentOverhead: number | undefined;
  let multiAgentOverheadPct: number | undefined;
  let totalCostWithMultiAgent = costPerIntent;

  if (mode === "multi-agent" && multiAgent) {
    const orchModel = getModel(multiAgent.orchestratorModelId);
    const orchInputPrice = orchModel?.inputPricePerMTok ?? 0;

    // Orchestrator cost: 1 call
    const orchestratorCost = multiAgent.orchestratorCostPerCall;

    // Specialist costs: each step is treated as a specialist call
    // (the step costs already cover specialist inference)
    // Communication overhead: handoffs between agents
    const numHandoffs = multiAgent.numSpecialists;
    const communicationOverhead =
      (numHandoffs * multiAgent.handoffTokens) / 1_000_000 * orchInputPrice * 2;

    multiAgentOverhead = orchestratorCost + communicationOverhead;
    totalCostWithMultiAgent = costPerIntent + multiAgentOverhead;
    multiAgentOverheadPct =
      totalCostWithMultiAgent > 0
        ? multiAgentOverhead / totalCostWithMultiAgent
        : 0;
  }

  // Cost per successful outcome
  const effectiveSuccessRate = Math.max(successRate, 0.01);
  const costPerOutcome = totalCostWithMultiAgent / effectiveSuccessRate;

  // Total context tokens (final step's context size)
  const totalContextTokens = stepCosts[stepCosts.length - 1].contextSize;

  return {
    steps: stepCosts,
    costPerIntent: totalCostWithMultiAgent,
    costPerOutcome,
    singleCallBaseline,
    multiplierVsBaseline:
      singleCallBaseline > 0 ? totalCostWithMultiAgent / singleCallBaseline : 1,
    toolOverheadTotal: totalToolOverheadCost,
    toolOverheadPct,
    multiAgentOverhead,
    multiAgentOverheadPct,
    totalContextTokens,
  };
}
