"use client";

import { useEffect, useMemo } from "react";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TokenCostInput, TokenCostOutput, ModelComparisonRow } from "@/lib/types";
import { MODEL_PRICES, LANGUAGE_MULTIPLIERS, getModel, MODEL_OPTIONS_GROUPED } from "@/lib/data/models";
import { calculateTokenCost } from "@/lib/calculations/token-cost";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatCurrency, formatPct, formatTokens, formatNumber } from "@/lib/utils";
import { NumberInput } from "@/components/inputs/number-input";
import { SliderInput } from "@/components/inputs/slider-input";
import { SelectInput } from "@/components/inputs/select-input";
import { ToggleInput } from "@/components/inputs/toggle-input";
import { StatCard } from "@/components/outputs/stat-card";
import { DataTable } from "@/components/outputs/data-table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";


const LANGUAGE_OPTIONS = [
  { value: "en", label: "English (1.0x)" },
  { value: "ru", label: "Russian (1.5x)" },
  { value: "zh", label: "Chinese (2.0x)" },
  { value: "ar", label: "Arabic (1.8x)" },
  { value: "other", label: "Other (1.5x)" },
];

const PIE_COLORS = ["#4F7FFF", "#22C55E", "#F59E0B"];

const DEFAULT_INPUT: TokenCostInput = {
  inputTokens: 1000,
  outputTokens: 500,
  modelId: "claude-sonnet",
  language: "en",
  batchApi: false,
  promptCaching: false,
  cacheHitRate: 0.5,
  cachedTokens: 500,
  extendedThinking: false,
  thinkingTokens: 1000,
  requestsPerMonth: 10000,
  mrrForIndicator: undefined,
};

export default function TokenCostPage() {
  const [input, setInput] = usePersistedState<TokenCostInput>(STORAGE_KEYS.tokenCost, DEFAULT_INPUT);
  const setTokenCost = useCalculatorStore((s) => s.setTokenCost);

  const output = useMemo(() => calculateTokenCost(input), [input]);

  const model = getModel(input.modelId);

  // Sync to Zustand store
  useEffect(() => {
    if (!model) return;
    setTokenCost({
      costPerRequest: output.costPerRequest,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      modelId: input.modelId,
      monthlyCost: output.monthlyCost,
      inputPricePerMTok: model.inputPricePerMTok,
      outputPricePerMTok: model.outputPricePerMTok,
      requestsPerMonth: input.requestsPerMonth,
    });
  }, [output, input, model, setTokenCost]);

  function update<K extends keyof TokenCostInput>(key: K, value: TokenCostInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  // Chart data
  const barData = output.modelComparison.map((row) => ({
    name: row.modelName.replace(/\s+/g, "\n"),
    shortName: row.modelName.split(" ").slice(0, 2).join(" "),
    costPerRequest: row.costPerRequest,
    isSelected: row.modelId === input.modelId,
  }));

  const pieData = [
    { name: "Input", value: output.inputCost },
    { name: "Output", value: output.outputCost },
    ...(output.thinkingCost > 0
      ? [{ name: "Thinking", value: output.thinkingCost }]
      : []),
  ].filter((d) => d.value > 0);

  const cheapestModelId = output.modelComparison[0]?.modelId;

  const comparisonColumns = [
    {
      key: "modelName",
      header: "Model",
      render: (row: ModelComparisonRow) => {
        const isCheapest = row.modelId === cheapestModelId;
        const isSelected = row.modelId === input.modelId;
        return (
          <span className={isSelected ? "text-accent font-semibold" : isCheapest ? "text-positive font-semibold" : "text-text-primary"}>
            {row.modelName}
            {isCheapest && <span className="ml-1.5 text-[10px] text-positive">cheapest</span>}
          </span>
        );
      },
    },
    {
      key: "costPerRequest",
      header: "Cost / Request",
      align: "right" as const,
      render: (row: ModelComparisonRow) => (
        <span className="text-text-primary">{formatCurrency(row.costPerRequest, 6)}</span>
      ),
    },
    {
      key: "monthlyCost",
      header: "Monthly Cost",
      align: "right" as const,
      render: (row: ModelComparisonRow) => (
        <span className="text-text-primary">{formatCurrency(row.monthlyCost, 2)}</span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Token Cost Calculator</h2>
        <p className="text-xs text-text-secondary mt-1">
          Module 2.1: Calculate per-request and monthly API costs across models, languages, and modifiers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left panel: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          {/* Model + Language */}
          <Card>
            <CardHeader>
              <CardTitle>Model & Language</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <SelectInput
                label="Model"
                value={input.modelId}
                onChange={(v) => update("modelId", v)}
                options={MODEL_OPTIONS_GROUPED}
              />
              {model && (
                <div className="text-[10px] text-text-muted font-mono">
                  Input: ${model.inputPricePerMTok}/MTok · Output: ${model.outputPricePerMTok}/MTok · Context: {formatTokens(model.contextWindow)}
                </div>
              )}
              <SelectInput
                label="Language"
                value={input.language}
                onChange={(v) => update("language", v as TokenCostInput["language"])}
                options={LANGUAGE_OPTIONS}
              />
            </div>
          </Card>

          {/* Token Counts */}
          <Card>
            <CardHeader>
              <CardTitle>Token Counts</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Input tokens"
                value={input.inputTokens}
                onChange={(v) => update("inputTokens", Math.max(0, v))}
                min={0}
                step={100}
                suffix="tokens"
              />
              <NumberInput
                label="Output tokens"
                value={input.outputTokens}
                onChange={(v) => update("outputTokens", Math.max(0, v))}
                min={0}
                step={100}
                suffix="tokens"
              />
            </div>
          </Card>

          {/* Modifiers */}
          <Card>
            <CardHeader>
              <CardTitle>Modifiers</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <ToggleInput
                label="Batch API (50% discount)"
                checked={input.batchApi}
                onChange={(v) => update("batchApi", v)}
              />

              <div className="space-y-2">
                <ToggleInput
                  label="Prompt Caching"
                  checked={input.promptCaching}
                  onChange={(v) => update("promptCaching", v)}
                />
                {input.promptCaching && (
                  <div className="pl-4 space-y-2 border-l border-border">
                    <NumberInput
                      label="Cached tokens (prefix)"
                      value={input.cachedTokens}
                      onChange={(v) =>
                        update("cachedTokens", Math.max(0, Math.min(v, input.inputTokens)))
                      }
                      min={0}
                      max={input.inputTokens}
                      step={100}
                      suffix="tokens"
                    />
                    <SliderInput
                      label="Cache hit rate"
                      value={input.cacheHitRate}
                      onChange={(v) => update("cacheHitRate", v)}
                      min={0}
                      max={1}
                      step={0.05}
                      formatValue={(v) => formatPct(v, 0)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <ToggleInput
                  label="Extended Thinking"
                  checked={input.extendedThinking}
                  onChange={(v) => update("extendedThinking", v)}
                />
                {input.extendedThinking && (
                  <div className="pl-4 border-l border-border">
                    <NumberInput
                      label="Thinking tokens"
                      value={input.thinkingTokens}
                      onChange={(v) => update("thinkingTokens", Math.max(0, v))}
                      min={0}
                      step={100}
                      suffix="tokens"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Volume */}
          <Card>
            <CardHeader>
              <CardTitle>Volume</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Requests per month"
                value={input.requestsPerMonth}
                onChange={(v) => update("requestsPerMonth", Math.max(0, v))}
                min={0}
                step={1000}
              />
              <NumberInput
                label="MRR (optional, for cost share)"
                value={input.mrrForIndicator ?? 0}
                onChange={(v) => update("mrrForIndicator", v > 0 ? v : undefined)}
                min={0}
                step={100}
                prefix="$"
                hint="If set, shows inference cost as % of MRR"
              />
            </div>
          </Card>
        </div>

        {/* Right panel: Outputs */}
        <div className="lg:col-span-8 space-y-4">
          {/* Key metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>Per-request cost at current settings</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Cost / Request"
                value={formatCurrency(output.costPerRequest, 6)}
              />
              <StatCard
                label="Monthly Cost"
                value={formatCurrency(output.monthlyCost, 2)}
                subValue={`${formatNumber(input.requestsPerMonth)} requests`}
              />
              <StatCard
                label="Output Share"
                value={formatPct(output.outputSharePct)}
              />
              {output.mrrSharePct !== undefined && (
                <StatCard
                  label="Cost / MRR"
                  value={formatPct(output.mrrSharePct)}
                  variant={output.mrrSharePct > 0.3 ? "negative" : output.mrrSharePct > 0.15 ? "caution" : "positive"}
                  subValue={
                    output.mrrSharePct > 0.3
                      ? "High: action needed"
                      : output.mrrSharePct > 0.15
                        ? "Monitor closely"
                        : "Healthy range"
                  }
                />
              )}
            </div>
          </Card>

          {/* Per-request detail */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Request Detail</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Input cost</span>
                <span className="font-mono text-text-primary">{formatCurrency(output.inputCost, 6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Output cost</span>
                <span className="font-mono text-text-primary">{formatCurrency(output.outputCost, 6)}</span>
              </div>
              {output.thinkingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Thinking cost</span>
                  <span className="font-mono text-text-primary">{formatCurrency(output.thinkingCost, 6)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span className="text-text-primary">Total / request</span>
                <span className="font-mono text-accent">{formatCurrency(output.costPerRequest, 6)}</span>
              </div>
              {input.batchApi && (
                <p className="text-[10px] text-text-muted">Batch API discount applied (50%)</p>
              )}
              {input.promptCaching && (
                <p className="text-[10px] text-text-muted">
                  Prompt caching: {formatPct(input.cacheHitRate, 0)} hit rate, {formatTokens(input.cachedTokens)} cached
                </p>
              )}
              {input.language !== "en" && (
                <p className="text-[10px] text-text-muted">
                  Language multiplier: {LANGUAGE_MULTIPLIERS[input.language]}x applied to token counts
                </p>
              )}
            </div>
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bar chart: model comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Model Comparison</CardTitle>
                <CardDescription>Cost per request across models</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 32, left: 8 }}>
                    <XAxis
                      dataKey="shortName"
                      tick={{ fontSize: 9, fill: "#999999" }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999999" }}
                      tickFormatter={(v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`}
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
                        color: "#E5E5E5",
                      }}
                      labelStyle={{ color: "#E5E5E5" }}
                      formatter={(value) => [formatCurrency(Number(value), 6), "Cost/Req"]}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar
                      dataKey="costPerRequest"
                      radius={[3, 3, 0, 0]}
                      fill="#4F7FFF"
                    >
                      {barData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isSelected ? "#4F7FFF" : "#2A2A2A"}
                          stroke={entry.isSelected ? "#4F7FFF" : "none"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Pie chart: cost split */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Split</CardTitle>
                <CardDescription>Input vs output vs thinking</CardDescription>
              </CardHeader>
              <div className="h-64">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={{ stroke: "#666666" }}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1A1A1A",
                          border: "1px solid #2A2A2A",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#E5E5E5",
                        }}
                        formatter={(value) => [formatCurrency(Number(value), 6), "Cost"]}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", color: "#999999" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted text-sm">
                    No cost data
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Model comparison table */}
          <Card>
            <CardHeader>
              <CardTitle>Full Model Comparison</CardTitle>
              <CardDescription>
                Same workload ({formatTokens(input.inputTokens)} in / {formatTokens(input.outputTokens)} out
                {input.extendedThinking ? ` / ${formatTokens(input.thinkingTokens)} thinking` : ""}
                ) across all models. Sorted by cost.
              </CardDescription>
            </CardHeader>
            <DataTable columns={comparisonColumns} data={output.modelComparison} />
          </Card>
        </div>
      </div>
    </div>
  );
}
