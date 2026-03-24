"use client";

import { useMemo, useEffect } from "react";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { STORAGE_KEYS } from "@/lib/constants";
import { calculateOptimizationStack } from "@/lib/calculations/optimization-stack";
import { OptimizationInput } from "@/lib/types";
import { formatCurrency, formatPct, formatNumber } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NumberInput } from "@/components/inputs/number-input";
import { SliderInput } from "@/components/inputs/slider-input";
import { ToggleInput } from "@/components/inputs/toggle-input";
import { StatCard } from "@/components/outputs/stat-card";
import { DataTable } from "@/components/outputs/data-table";
import { Download } from "lucide-react";

const EFFORT_MAP: Record<string, string> = {
  "Output Limits": "Low",
  "Prompt Caching": "Low-Medium",
  "Semantic Cache": "Medium-High",
  "Context Management": "Medium",
};

export default function OptimizationStackPage() {
  const { tokenCost, setOptimization } = useCalculatorStore();

  const [input, setInput] = usePersistedState<OptimizationInput>(STORAGE_KEYS.optimization, {
    inputTokens: 1000,
    outputTokens: 500,
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
    requestsPerMonth: 10000,
    outputLimitsEnabled: false,
    newOutputTokens: 300,
    promptCachingEnabled: false,
    cachedPrefixTokens: 600,
    cacheHitRate: 0.7,
    semanticCacheEnabled: false,
    faqTrafficShare: 0.3,
    semanticHitRate: 0.67,
    contextMgmtEnabled: false,
    contextReductionPct: 0.3,
  });

  const output = useMemo(() => calculateOptimizationStack(input), [input]);

  // Sync to Zustand store
  useEffect(() => {
    const lastLayer = output.layers[output.layers.length - 1];
    setOptimization({
      optimizedCostPerRequest: lastLayer.costPerRequest,
      savingsPct: output.cumulativeSavingsPct,
    });
  }, [output, setOptimization]);

  function pullFromTokenCost() {
    if (!tokenCost) return;
    setInput((prev) => ({
      ...prev,
      inputTokens: tokenCost.inputTokens,
      outputTokens: tokenCost.outputTokens,
      inputPricePerMTok: tokenCost.inputPricePerMTok,
      outputPricePerMTok: tokenCost.outputPricePerMTok,
      newOutputTokens: Math.round(tokenCost.outputTokens * 0.6),
      cachedPrefixTokens: Math.round(tokenCost.inputTokens * 0.6),
    }));
  }

  function update(patch: Partial<OptimizationInput>) {
    setInput((prev) => ({ ...prev, ...patch }));
  }

  // Waterfall chart data
  const waterfallData = useMemo(() => {
    const baselineCost =
      (input.inputTokens / 1_000_000) * input.inputPricePerMTok +
      (input.outputTokens / 1_000_000) * input.outputPricePerMTok;
    const baseline = baselineCost * input.requestsPerMonth;

    const items: { name: string; value: number; savings: number; isBaseline?: boolean; isFinal?: boolean }[] = [
      { name: "Baseline", value: baseline, savings: 0, isBaseline: true },
    ];

    let prevCost = baseline;
    for (const layer of output.layers) {
      const diff = prevCost - layer.monthlyCost;
      if (diff > 0.001) {
        items.push({ name: layer.name, value: -diff, savings: diff });
      }
      prevCost = layer.monthlyCost;
    }

    items.push({ name: "Final", value: output.finalMonthlyCost, savings: 0, isFinal: true });

    return items;
  }, [input, output]);

  // Running total for waterfall positioning
  const waterfallBars = useMemo(() => {
    const baselineVal = waterfallData[0].value;
    let runningTotal = baselineVal;

    return waterfallData.map((item) => {
      if (item.isBaseline) {
        return { ...item, base: 0, visible: item.value };
      }
      if (item.isFinal) {
        return { ...item, base: 0, visible: item.value };
      }
      // Savings bar: starts where previous ended, goes down
      const top = runningTotal;
      runningTotal = runningTotal + item.value; // item.value is negative
      return { ...item, base: runningTotal, visible: Math.abs(item.value) };
    });
  }, [waterfallData]);

  const layerTableData = output.layers.map((layer) => ({
    ...layer,
    effort: EFFORT_MAP[layer.name] || "N/A",
  }));

  const tableColumns = [
    {
      key: "name",
      header: "Layer",
      render: (row: (typeof layerTableData)[0]) => (
        <span className="text-text-primary">{row.name}</span>
      ),
    },
    {
      key: "effort",
      header: "Effort",
      render: (row: (typeof layerTableData)[0]) => (
        <span className="text-text-secondary">{row.effort}</span>
      ),
    },
    {
      key: "savingsPct",
      header: "Layer Savings",
      align: "right" as const,
      render: (row: (typeof layerTableData)[0]) => (
        <span className={row.savingsPct > 0 ? "text-positive" : "text-text-muted"}>
          {formatPct(row.savingsPct)}
        </span>
      ),
    },
    {
      key: "cumulativeSavingsPct",
      header: "Cumulative",
      align: "right" as const,
      render: (row: (typeof layerTableData)[0]) => (
        <span className={row.cumulativeSavingsPct > 0 ? "text-positive" : "text-text-muted"}>
          {formatPct(row.cumulativeSavingsPct)}
        </span>
      ),
    },
    {
      key: "monthlyCost",
      header: "Monthly Cost",
      align: "right" as const,
      render: (row: (typeof layerTableData)[0]) => (
        <span className="text-text-primary">{formatCurrency(row.monthlyCost, 2)}</span>
      ),
    },
  ];

  const anyLayerEnabled =
    input.outputLimitsEnabled ||
    input.promptCachingEnabled ||
    input.semanticCacheEnabled ||
    input.contextMgmtEnabled;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Optimization Stack Simulator
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Model cost reduction through stacked optimizations. Each layer compounds on previous savings.
          </p>
        </div>
        <button
          onClick={pullFromTokenCost}
          disabled={!tokenCost}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          Pull from Token Cost
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* Left panel: Inputs */}
        <div className="space-y-4">
          {/* Baseline */}
          <Card>
            <CardHeader>
              <CardTitle>Baseline</CardTitle>
              <CardDescription>Current cost without optimizations</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Input tokens"
                value={input.inputTokens}
                onChange={(v) => update({ inputTokens: v })}
                min={0}
                step={100}
              />
              <NumberInput
                label="Output tokens"
                value={input.outputTokens}
                onChange={(v) => update({ outputTokens: v })}
                min={0}
                step={100}
              />
              <NumberInput
                label="Input price"
                value={input.inputPricePerMTok}
                onChange={(v) => update({ inputPricePerMTok: v })}
                min={0}
                step={0.1}
                prefix="$"
                suffix="/MTok"
              />
              <NumberInput
                label="Output price"
                value={input.outputPricePerMTok}
                onChange={(v) => update({ outputPricePerMTok: v })}
                min={0}
                step={0.1}
                prefix="$"
                suffix="/MTok"
              />
              <NumberInput
                label="Requests / month"
                value={input.requestsPerMonth}
                onChange={(v) => update({ requestsPerMonth: v })}
                min={0}
                step={1000}
                className="col-span-2"
              />
            </div>
          </Card>

          {/* Layer 1: Output Limits */}
          <LayerCard
            title="Layer 1: Output Limits"
            description="Constrain max_tokens to reduce output cost"
            enabled={input.outputLimitsEnabled}
            onToggle={(v) => update({ outputLimitsEnabled: v })}
          >
            <SliderInput
              label="New output tokens"
              value={input.newOutputTokens}
              onChange={(v) => update({ newOutputTokens: v })}
              min={50}
              max={input.outputTokens}
              step={10}
              formatValue={(v) => `${v} tok`}
            />
            <p className="text-[10px] text-text-muted mt-1">
              Baseline: {formatNumber(input.outputTokens)} tokens.
              Reduction: {input.outputTokens > 0 ? formatPct(1 - input.newOutputTokens / input.outputTokens) : "0%"}
            </p>
          </LayerCard>

          {/* Layer 2: Prompt Caching */}
          <LayerCard
            title="Layer 2: Prompt Caching"
            description="Cache static prompt prefix for 90% input cost reduction on hits"
            enabled={input.promptCachingEnabled}
            onToggle={(v) => update({ promptCachingEnabled: v })}
          >
            <SliderInput
              label="Cached prefix tokens"
              value={input.cachedPrefixTokens}
              onChange={(v) => update({ cachedPrefixTokens: v })}
              min={0}
              max={input.inputTokens}
              step={50}
              formatValue={(v) => `${v} tok`}
            />
            <SliderInput
              label="Cache hit rate"
              value={input.cacheHitRate}
              onChange={(v) => update({ cacheHitRate: v })}
              min={0}
              max={1}
              step={0.05}
              formatValue={(v) => formatPct(v)}
            />
          </LayerCard>

          {/* Layer 3: Semantic Cache */}
          <LayerCard
            title="Layer 3: Semantic Cache"
            description="Deflect repeated/similar queries with vector similarity"
            enabled={input.semanticCacheEnabled}
            onToggle={(v) => update({ semanticCacheEnabled: v })}
          >
            <SliderInput
              label="FAQ-like traffic share"
              value={input.faqTrafficShare}
              onChange={(v) => update({ faqTrafficShare: v })}
              min={0}
              max={1}
              step={0.05}
              formatValue={(v) => formatPct(v)}
            />
            <SliderInput
              label="Semantic hit rate"
              value={input.semanticHitRate}
              onChange={(v) => update({ semanticHitRate: v })}
              min={0}
              max={1}
              step={0.05}
              formatValue={(v) => formatPct(v)}
            />
            <p className="text-[10px] text-text-muted mt-1">
              Deflection rate: {formatPct(input.faqTrafficShare * input.semanticHitRate)}
            </p>
          </LayerCard>

          {/* Layer 4: Context Management */}
          <LayerCard
            title="Layer 4: Context Management"
            description="Summarize/trim conversation history, reduce input size"
            enabled={input.contextMgmtEnabled}
            onToggle={(v) => update({ contextMgmtEnabled: v })}
          >
            <SliderInput
              label="Context reduction"
              value={input.contextReductionPct}
              onChange={(v) => update({ contextReductionPct: v })}
              min={0.2}
              max={0.8}
              step={0.05}
              formatValue={(v) => formatPct(v)}
            />
          </LayerCard>
        </div>

        {/* Right panel: Results */}
        <div className="space-y-4">
          {/* Summary stats */}
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Baseline / month"
                value={formatCurrency(output.baselineMonthlyCost, 2)}
              />
              <StatCard
                label="Optimized / month"
                value={formatCurrency(output.finalMonthlyCost, 2)}
                variant={anyLayerEnabled ? "positive" : "default"}
              />
              <StatCard
                label="Monthly savings"
                value={formatCurrency(output.baselineMonthlyCost - output.finalMonthlyCost, 2)}
                variant={output.cumulativeSavingsPct > 0 ? "positive" : "default"}
              />
              <StatCard
                label="Total reduction"
                value={formatPct(output.cumulativeSavingsPct)}
                variant={
                  output.cumulativeSavingsPct >= 0.5
                    ? "positive"
                    : output.cumulativeSavingsPct > 0
                      ? "caution"
                      : "default"
                }
              />
            </div>
          </Card>

          {/* Waterfall chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Waterfall</CardTitle>
              <CardDescription>Monthly cost reduction through each optimization layer</CardDescription>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={waterfallBars}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#999999", fontSize: 11 }}
                    axisLine={{ stroke: "#2A2A2A" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#999999", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A1A",
                      border: "1px solid #2A2A2A",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#E5E5E5",
                    }}
                    labelStyle={{ color: "#E5E5E5" }}
                    formatter={(value, name) => {
                      if (name === "base") return [null, null];
                      return [formatCurrency(Number(value), 2), "Amount"];
                    }}
                    itemStyle={{ color: "#E5E5E5" }}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <ReferenceLine y={0} stroke="#2A2A2A" />
                  {/* Invisible base bar for stacking */}
                  <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                  {/* Visible bar */}
                  <Bar dataKey="visible" stackId="waterfall" radius={[3, 3, 0, 0]}>
                    {waterfallBars.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.isBaseline || entry.isFinal
                            ? "#4F7FFF"
                            : "#22C55E"
                        }
                        fillOpacity={entry.isFinal ? 0.7 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Layer breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle>Layer Breakdown</CardTitle>
            </CardHeader>
            <DataTable columns={tableColumns} data={layerTableData} />
          </Card>

          {/* Per-request breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Request Cost</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Baseline / request"
                value={formatCurrency(
                  (input.inputTokens / 1_000_000) * input.inputPricePerMTok +
                  (input.outputTokens / 1_000_000) * input.outputPricePerMTok
                )}
              />
              <StatCard
                label="Optimized / request"
                value={formatCurrency(output.layers[output.layers.length - 1].costPerRequest)}
                variant={anyLayerEnabled ? "positive" : "default"}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Collapsible layer card
function LayerCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={enabled ? "border-accent/30" : "opacity-70"}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
          <p className="text-[10px] text-text-secondary mt-0.5">{description}</p>
        </div>
        <ToggleInput label="" checked={enabled} onChange={onToggle} />
      </div>
      {enabled && <div className="space-y-3 pt-2 border-t border-border">{children}</div>}
    </Card>
  );
}
