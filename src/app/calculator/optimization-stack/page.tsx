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
import { useFieldSync } from "@/lib/hooks/use-field-sync";

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

  const syncConfig = useMemo(() => [
    { field: "inputTokens", upstream: () => tokenCost?.inputTokens, source: "Token Cost" },
    { field: "outputTokens", upstream: () => tokenCost?.outputTokens, source: "Token Cost" },
    { field: "inputPricePerMTok", upstream: () => tokenCost?.inputPricePerMTok, source: "Token Cost" },
    { field: "outputPricePerMTok", upstream: () => tokenCost?.outputPricePerMTok, source: "Token Cost" },
    { field: "requestsPerMonth", upstream: () => tokenCost?.requestsPerMonth, source: "Token Cost" },
  ], [tokenCost]);

  const { markOverride, resetField, getSyncSource, isFieldOverridden } = useFieldSync(
    input,
    setInput,
    syncConfig,
    STORAGE_KEYS.optimizationOverrides,
  );

  const output = useMemo(() => calculateOptimizationStack(input), [input]);

  // Sync to Zustand store
  useEffect(() => {
    const lastLayer = output.layers[output.layers.length - 1];
    setOptimization({
      optimizedCostPerRequest: lastLayer.costPerRequest,
      savingsPct: output.cumulativeSavingsPct,
    });
  }, [output, setOptimization]);

  function update(patch: Partial<OptimizationInput>) {
    setInput((prev) => ({ ...prev, ...patch }));
  }

  // Cost cascade data: cost after each stage
  const cascadeData = useMemo(() => {
    const items: { name: string; cost: number; isBaseline?: boolean }[] = [
      { name: "Baseline", cost: output.baselineMonthlyCost, isBaseline: true },
    ];

    for (const layer of output.layers) {
      if (layer.savingsPct > 0.0001) {
        items.push({ name: layer.name, cost: layer.monthlyCost });
      }
    }

    return items;
  }, [output]);

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
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Optimization Stack Simulator
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Model cost reduction through stacked optimizations. Each layer compounds on previous savings.
        </p>
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
                onChange={(v) => { update({ inputTokens: v }); markOverride("inputTokens"); }}
                min={0}
                step={100}
                syncSource={getSyncSource("inputTokens") ?? undefined}
                onSyncReset={isFieldOverridden("inputTokens") ? () => resetField("inputTokens") : undefined}
              />
              <NumberInput
                label="Output tokens"
                value={input.outputTokens}
                onChange={(v) => { update({ outputTokens: v }); markOverride("outputTokens"); }}
                min={0}
                step={100}
                syncSource={getSyncSource("outputTokens") ?? undefined}
                onSyncReset={isFieldOverridden("outputTokens") ? () => resetField("outputTokens") : undefined}
              />
              <NumberInput
                label="Input price"
                value={input.inputPricePerMTok}
                onChange={(v) => { update({ inputPricePerMTok: v }); markOverride("inputPricePerMTok"); }}
                min={0}
                step={0.1}
                prefix="$"
                suffix="/MTok"
                syncSource={getSyncSource("inputPricePerMTok") ?? undefined}
                onSyncReset={isFieldOverridden("inputPricePerMTok") ? () => resetField("inputPricePerMTok") : undefined}
              />
              <NumberInput
                label="Output price"
                value={input.outputPricePerMTok}
                onChange={(v) => { update({ outputPricePerMTok: v }); markOverride("outputPricePerMTok"); }}
                min={0}
                step={0.1}
                prefix="$"
                suffix="/MTok"
                syncSource={getSyncSource("outputPricePerMTok") ?? undefined}
                onSyncReset={isFieldOverridden("outputPricePerMTok") ? () => resetField("outputPricePerMTok") : undefined}
              />
              <NumberInput
                label="Requests / month"
                value={input.requestsPerMonth}
                onChange={(v) => { update({ requestsPerMonth: v }); markOverride("requestsPerMonth"); }}
                min={0}
                step={1000}
                className="col-span-2"
                syncSource={getSyncSource("requestsPerMonth") ?? undefined}
                onSyncReset={isFieldOverridden("requestsPerMonth") ? () => resetField("requestsPerMonth") : undefined}
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

          {/* Cost cascade chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Cascade</CardTitle>
              <CardDescription>Monthly cost after each optimization layer</CardDescription>
            </CardHeader>
            <div style={{ height: Math.max(160, cascadeData.length * 48 + 20) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cascadeData}
                  layout="vertical"
                  margin={{ top: 5, right: 40, left: 5, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "#999999", fontSize: 11 }}
                    axisLine={{ stroke: "#2A2A2A" }}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#999999", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
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
                    formatter={(value) => [formatCurrency(Number(value), 2), "Monthly cost"]}
                    itemStyle={{ color: "#E5E5E5" }}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar dataKey="cost" radius={[0, 3, 3, 0]}>
                    {cascadeData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.isBaseline ? "#666666" : "#22C55E"}
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
