"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AgentCostInput, AgentStep, AgentStepCost } from "@/lib/types";
import { MODEL_PRICES } from "@/lib/data/models";
import { calculateAgentCost } from "@/lib/calculations/agent-cost";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { formatCurrency, formatPct, formatTokens } from "@/lib/utils";
import { NumberInput } from "@/components/inputs/number-input";
import { SliderInput } from "@/components/inputs/slider-input";
import { SelectInput } from "@/components/inputs/select-input";
import { ToggleInput } from "@/components/inputs/toggle-input";
import { StatCard } from "@/components/outputs/stat-card";
import { DataTable } from "@/components/outputs/data-table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const MODEL_OPTIONS = MODEL_PRICES.map((m) => ({
  value: m.id,
  label: `${m.name} (${m.provider})`,
}));

const DEFAULT_STEPS: AgentStep[] = [
  { newInputTokens: 1000, outputTokens: 500, modelId: "claude-sonnet", toolUse: true, toolResultTokens: 300 },
  { newInputTokens: 200, outputTokens: 800, modelId: "claude-sonnet", toolUse: true, toolResultTokens: 500 },
  { newInputTokens: 150, outputTokens: 600, modelId: "claude-sonnet", toolUse: false },
];

const DEFAULT_INPUT: AgentCostInput = {
  steps: DEFAULT_STEPS,
  toolDefinitions: {
    numTools: 5,
    avgToolDefSize: 200,
    systemOverhead: 500,
  },
  mode: "single-agent",
  multiAgent: {
    numSpecialists: 3,
    orchestratorModelId: "claude-sonnet",
    orchestratorCostPerCall: 0.01,
    handoffTokens: 500,
  },
  successRate: 0.85,
  retryRate: 0.1,
};

export default function AgentCostPage() {
  const [input, setInput] = useState<AgentCostInput>(DEFAULT_INPUT);
  const setAgentCost = useCalculatorStore((s) => s.setAgentCost);

  const output = useMemo(() => calculateAgentCost(input), [input]);

  useEffect(() => {
    setAgentCost({
      costPerIntent: output.costPerIntent,
      costPerOutcome: output.costPerOutcome,
    });
  }, [output, setAgentCost]);

  function updateStep(index: number, patch: Partial<AgentStep>) {
    setInput((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addStep() {
    if (input.steps.length >= 15) return;
    setInput((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          newInputTokens: 200,
          outputTokens: 500,
          modelId: "claude-sonnet",
          toolUse: false,
        },
      ],
    }));
  }

  function removeStep(index: number) {
    if (input.steps.length <= 1) return;
    setInput((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  // Chart data: context growth
  const contextChartData = output.steps.map((s) => ({
    name: `Step ${s.step}`,
    context: s.contextSize,
    effective: s.effectiveInput,
  }));

  // Chart data: cost per step breakdown
  const costBarData = output.steps.map((s) => ({
    name: `Step ${s.step}`,
    inputCost: s.inputCost,
    outputCost: s.outputCost,
  }));

  // Table columns
  const stepColumns = [
    {
      key: "step",
      header: "Step",
      render: (row: AgentStepCost) => (
        <span className="text-text-primary">{row.step}</span>
      ),
    },
    {
      key: "contextSize",
      header: "Context",
      align: "right" as const,
      render: (row: AgentStepCost) => (
        <span className="text-text-primary">{formatTokens(row.contextSize)}</span>
      ),
    },
    {
      key: "effectiveInput",
      header: "Eff. Input",
      align: "right" as const,
      render: (row: AgentStepCost) => (
        <span className="text-text-primary">{formatTokens(row.effectiveInput)}</span>
      ),
    },
    {
      key: "inputCost",
      header: "Input Cost",
      align: "right" as const,
      render: (row: AgentStepCost) => (
        <span className="text-text-primary">{formatCurrency(row.inputCost, 6)}</span>
      ),
    },
    {
      key: "outputCost",
      header: "Output Cost",
      align: "right" as const,
      render: (row: AgentStepCost) => (
        <span className="text-text-primary">{formatCurrency(row.outputCost, 6)}</span>
      ),
    },
    {
      key: "totalCost",
      header: "Total",
      align: "right" as const,
      render: (row: AgentStepCost) => (
        <span className="text-accent font-semibold">{formatCurrency(row.totalCost, 6)}</span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Agent Cost Estimator</h2>
        <p className="text-xs text-text-secondary mt-1">
          Module 2.7: Estimate multi-step agent costs with context accumulation, tool overhead, and multi-agent routing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left panel: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          {/* Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Steps</CardTitle>
              <CardDescription>
                {input.steps.length} step{input.steps.length !== 1 ? "s" : ""} configured (max 15)
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              {input.steps.map((step, i) => (
                <div
                  key={i}
                  className="space-y-2 border border-border rounded p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">
                      Step {i + 1}
                    </span>
                    {input.steps.length > 1 && (
                      <button
                        onClick={() => removeStep(i)}
                        className="text-[10px] text-negative hover:text-negative/80 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <SelectInput
                    label="Model"
                    value={step.modelId}
                    onChange={(v) => updateStep(i, { modelId: v })}
                    options={MODEL_OPTIONS}
                  />
                  <NumberInput
                    label="New input tokens"
                    value={step.newInputTokens}
                    onChange={(v) => updateStep(i, { newInputTokens: Math.max(0, v) })}
                    min={0}
                    step={100}
                    suffix="tokens"
                  />
                  <NumberInput
                    label="Output tokens"
                    value={step.outputTokens}
                    onChange={(v) => updateStep(i, { outputTokens: Math.max(0, v) })}
                    min={0}
                    step={100}
                    suffix="tokens"
                  />
                  <ToggleInput
                    label="Tool use"
                    checked={step.toolUse}
                    onChange={(v) => updateStep(i, { toolUse: v })}
                  />
                  {step.toolUse && (
                    <div className="pl-4 border-l border-border">
                      <NumberInput
                        label="Tool result tokens"
                        value={step.toolResultTokens ?? 0}
                        onChange={(v) =>
                          updateStep(i, { toolResultTokens: Math.max(0, v) })
                        }
                        min={0}
                        step={100}
                        suffix="tokens"
                      />
                    </div>
                  )}
                </div>
              ))}
              {input.steps.length < 15 && (
                <button
                  onClick={addStep}
                  className="w-full py-1.5 text-xs text-accent border border-border rounded hover:border-accent transition-colors"
                >
                  + Add Step
                </button>
              )}
            </div>
          </Card>

          {/* Tool Definitions */}
          <Card>
            <CardHeader>
              <CardTitle>Tool Definitions</CardTitle>
              <CardDescription>Overhead added to every tool-using step</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Number of tools"
                value={input.toolDefinitions.numTools}
                onChange={(v) =>
                  setInput((prev) => ({
                    ...prev,
                    toolDefinitions: {
                      ...prev.toolDefinitions,
                      numTools: Math.max(0, v),
                    },
                  }))
                }
                min={0}
                step={1}
              />
              <NumberInput
                label="Avg tool definition size"
                value={input.toolDefinitions.avgToolDefSize}
                onChange={(v) =>
                  setInput((prev) => ({
                    ...prev,
                    toolDefinitions: {
                      ...prev.toolDefinitions,
                      avgToolDefSize: Math.max(0, v),
                    },
                  }))
                }
                min={0}
                step={50}
                suffix="tokens"
              />
              <NumberInput
                label="System overhead"
                value={input.toolDefinitions.systemOverhead}
                onChange={(v) =>
                  setInput((prev) => ({
                    ...prev,
                    toolDefinitions: {
                      ...prev.toolDefinitions,
                      systemOverhead: Math.max(300, Math.min(700, v)),
                    },
                  }))
                }
                min={300}
                max={700}
                step={50}
                suffix="tokens"
                hint="300-700 tokens for system prompt"
              />
            </div>
          </Card>

          {/* Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Mode</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setInput((prev) => ({ ...prev, mode: "single-agent" }))}
                  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                    input.mode === "single-agent"
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-secondary hover:border-accent/50"
                  }`}
                >
                  Single Agent
                </button>
                <button
                  onClick={() => setInput((prev) => ({ ...prev, mode: "multi-agent" }))}
                  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                    input.mode === "multi-agent"
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-secondary hover:border-accent/50"
                  }`}
                >
                  Multi-Agent
                </button>
              </div>

              {input.mode === "multi-agent" && (
                <div className="space-y-3 border-l border-border pl-4">
                  <NumberInput
                    label="Number of specialists"
                    value={input.multiAgent?.numSpecialists ?? 3}
                    onChange={(v) =>
                      setInput((prev) => ({
                        ...prev,
                        multiAgent: {
                          ...prev.multiAgent!,
                          numSpecialists: Math.max(1, v),
                        },
                      }))
                    }
                    min={1}
                    step={1}
                  />
                  <SelectInput
                    label="Orchestrator model"
                    value={input.multiAgent?.orchestratorModelId ?? "claude-sonnet"}
                    onChange={(v) =>
                      setInput((prev) => ({
                        ...prev,
                        multiAgent: {
                          ...prev.multiAgent!,
                          orchestratorModelId: v,
                        },
                      }))
                    }
                    options={MODEL_OPTIONS}
                  />
                  <NumberInput
                    label="Orchestrator cost per call"
                    value={input.multiAgent?.orchestratorCostPerCall ?? 0.01}
                    onChange={(v) =>
                      setInput((prev) => ({
                        ...prev,
                        multiAgent: {
                          ...prev.multiAgent!,
                          orchestratorCostPerCall: Math.max(0, v),
                        },
                      }))
                    }
                    min={0}
                    step={0.001}
                    prefix="$"
                  />
                  <NumberInput
                    label="Handoff tokens"
                    value={input.multiAgent?.handoffTokens ?? 500}
                    onChange={(v) =>
                      setInput((prev) => ({
                        ...prev,
                        multiAgent: {
                          ...prev.multiAgent!,
                          handoffTokens: Math.max(0, v),
                        },
                      }))
                    }
                    min={0}
                    step={100}
                    suffix="tokens"
                    hint="Tokens exchanged per agent handoff"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Success & Retry */}
          <Card>
            <CardHeader>
              <CardTitle>Outcome Rates</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <SliderInput
                label="Success rate"
                value={input.successRate}
                onChange={(v) => setInput((prev) => ({ ...prev, successRate: v }))}
                min={0.5}
                max={1}
                step={0.01}
                formatValue={(v) => formatPct(v, 0)}
              />
              <SliderInput
                label="Retry rate"
                value={input.retryRate}
                onChange={(v) => setInput((prev) => ({ ...prev, retryRate: v }))}
                min={0}
                max={0.3}
                step={0.01}
                formatValue={(v) => formatPct(v, 0)}
              />
            </div>
          </Card>
        </div>

        {/* Right panel: Outputs */}
        <div className="lg:col-span-8 space-y-4">
          {/* Key metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Summary</CardTitle>
              <CardDescription>
                {input.steps.length}-step {input.mode} flow
              </CardDescription>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Cost / Intent"
                value={formatCurrency(output.costPerIntent, 6)}
                subValue={`${input.steps.length} steps total`}
              />
              <StatCard
                label="Cost / Outcome"
                value={formatCurrency(output.costPerOutcome, 6)}
                subValue={`at ${formatPct(input.successRate, 0)} success`}
                variant={
                  output.costPerOutcome > output.costPerIntent * 2
                    ? "negative"
                    : output.costPerOutcome > output.costPerIntent * 1.3
                      ? "caution"
                      : "default"
                }
              />
              <StatCard
                label="Multiplier vs Single"
                value={`${output.multiplierVsBaseline.toFixed(1)}x`}
                subValue={`baseline: ${formatCurrency(output.singleCallBaseline, 6)}`}
                variant={
                  output.multiplierVsBaseline > 10
                    ? "negative"
                    : output.multiplierVsBaseline > 5
                      ? "caution"
                      : "default"
                }
              />
              <StatCard
                label="Tool Overhead"
                value={formatPct(output.toolOverheadPct)}
                subValue={formatCurrency(output.toolOverheadTotal, 6)}
              />
            </div>
            {output.multiAgentOverhead !== undefined && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Multi-agent overhead</span>
                  <span className="font-mono text-text-primary">
                    {formatCurrency(output.multiAgentOverhead, 6)}{" "}
                    <span className="text-text-muted">
                      ({formatPct(output.multiAgentOverheadPct ?? 0)})
                    </span>
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Area chart: context growth */}
            <Card>
              <CardHeader>
                <CardTitle>Context Growth</CardTitle>
                <CardDescription>Token accumulation across steps</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={contextChartData}
                    margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#999999" }}
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999999" }}
                      tickFormatter={(v: number) => formatTokens(v)}
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1A1A1A",
                        border: "1px solid #2A2A2A",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "#E5E5E5" }}
                      formatter={(value, name) => [
                        formatTokens(Number(value)),
                        name === "context" ? "Context" : "Effective Input",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="context"
                      stroke="#4F7FFF"
                      fill="#4F7FFF"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Stacked bar chart: cost per step */}
            <Card>
              <CardHeader>
                <CardTitle>Cost per Step</CardTitle>
                <CardDescription>Input vs output cost breakdown</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={costBarData}
                    margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#999999" }}
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999999" }}
                      tickFormatter={(v: number) =>
                        `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`
                      }
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1A1A1A",
                        border: "1px solid #2A2A2A",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "#E5E5E5" }}
                      formatter={(value, name) => [
                        formatCurrency(Number(value), 6),
                        name === "inputCost" ? "Input Cost" : "Output Cost",
                      ]}
                    />
                    <Bar
                      dataKey="inputCost"
                      stackId="cost"
                      fill="#4F7FFF"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="outputCost"
                      stackId="cost"
                      fill="#22C55E"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Step-by-step table */}
          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Breakdown</CardTitle>
              <CardDescription>
                Total context: {formatTokens(output.totalContextTokens)} tokens at final step
              </CardDescription>
            </CardHeader>
            <DataTable columns={stepColumns} data={output.steps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
