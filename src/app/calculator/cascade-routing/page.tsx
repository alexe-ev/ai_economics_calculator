"use client";

import { useEffect, useMemo } from "react";
import { useFieldSync } from "@/lib/hooks/use-field-sync";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { CascadeRoutingInput, CascadeTier } from "@/lib/types";
import { MODEL_PRICES, getModel, MODEL_OPTIONS_GROUPED } from "@/lib/data/models";
import { calculateCascadeRouting } from "@/lib/calculations/cascade-routing";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatCurrency, formatPct, formatNumber } from "@/lib/utils";
import { NumberInput } from "@/components/inputs/number-input";
import { SliderInput } from "@/components/inputs/slider-input";
import { SelectInput } from "@/components/inputs/select-input";
import { StatCard } from "@/components/outputs/stat-card";
import { DataTable } from "@/components/outputs/data-table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";


const TIER_COLORS = ["#22C55E", "#4F7FFF", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#14B8A6", "#F97316"];

function estimateCostPerRequest(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = getModel(modelId);
  if (!model) return 0;
  return (inputTokens / 1_000_000) * model.inputPricePerMTok +
    (outputTokens / 1_000_000) * model.outputPricePerMTok;
}

const DEFAULT_TIERS: CascadeTier[] = [
  { modelId: "claude-haiku", trafficPct: 0.6, costPerRequest: 0.0006, qualityScore: 70 },
  { modelId: "claude-sonnet", trafficPct: 0.3, costPerRequest: 0.0018, qualityScore: 90 },
  { modelId: "claude-opus", trafficPct: 0.1, costPerRequest: 0.003, qualityScore: 99 },
];

const DEFAULT_INPUT: CascadeRoutingInput = {
  totalRequestsPerMonth: 100_000,
  classifierModelId: "claude-haiku",
  classifierCostPerRequest: 0.00005,
  tiers: DEFAULT_TIERS,
};

export default function CascadeRoutingPage() {
  const [input, setInput] = usePersistedState<CascadeRoutingInput>(STORAGE_KEYS.cascadeRouting, DEFAULT_INPUT);
  const setCascadeRouting = useCalculatorStore((s) => s.setCascadeRouting);
  const tokenCost = useCalculatorStore((s) => s.tokenCost);

  const output = useMemo(() => calculateCascadeRouting(input), [input]);

  // Sync to Zustand store
  useEffect(() => {
    setCascadeRouting({
      blendedCostPerRequest: output.blendedCostPerRequest,
      blendedQuality: output.blendedQuality,
    });
  }, [output, setCascadeRouting]);

  const syncConfig = useMemo(() => [
    { field: "totalRequestsPerMonth", upstream: () => tokenCost?.requestsPerMonth, source: "Token Cost" },
  ], [tokenCost]);

  const { markOverride, resetField, getSyncSource, isFieldOverridden } = useFieldSync(
    input,
    setInput,
    syncConfig,
    STORAGE_KEYS.cascadeOverrides,
  );

  function updateTier(index: number, patch: Partial<CascadeTier>) {
    setInput((prev) => {
      const newTiers = prev.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
      return { ...prev, tiers: newTiers };
    });
  }

  function updateTrafficPct(index: number, newPct: number) {
    setInput((prev) => {
      const tiers = [...prev.tiers];
      const oldPct = tiers[index].trafficPct;
      const delta = newPct - oldPct;

      // Distribute delta proportionally across other tiers
      const othersTotal = tiers.reduce(
        (sum, t, i) => (i === index ? sum : sum + t.trafficPct),
        0
      );

      const newTiers = tiers.map((t, i) => {
        if (i === index) return { ...t, trafficPct: newPct };
        if (othersTotal === 0) {
          // Edge case: all others are 0, distribute equally
          const remaining = 1 - newPct;
          const otherCount = tiers.length - 1;
          return { ...t, trafficPct: remaining / otherCount };
        }
        const proportion = t.trafficPct / othersTotal;
        const adjusted = t.trafficPct - delta * proportion;
        return { ...t, trafficPct: Math.max(0, Math.min(1, adjusted)) };
      });

      // Normalize to ensure sum = 1
      const total = newTiers.reduce((sum, t) => sum + t.trafficPct, 0);
      if (Math.abs(total - 1) > 0.001) {
        const fixIdx = newTiers.findIndex((_, i) => i !== index && newTiers[i].trafficPct > 0);
        if (fixIdx >= 0) {
          newTiers[fixIdx].trafficPct += 1 - total;
        }
      }

      return { ...prev, tiers: newTiers };
    });
  }

  function addTier() {
    setInput((prev) => {
      // Take 10% from the biggest tier for the new one
      const tiers = [...prev.tiers];
      const biggestIdx = tiers.reduce((bi, t, i) => (t.trafficPct > tiers[bi].trafficPct ? i : bi), 0);
      tiers[biggestIdx] = { ...tiers[biggestIdx], trafficPct: tiers[biggestIdx].trafficPct - 0.1 };
      const newTier: CascadeTier = {
        modelId: "gemini-flash",
        trafficPct: 0.1,
        costPerRequest: 0.001,
        qualityScore: 80,
      };
      return { ...prev, tiers: [...tiers, newTier] };
    });
  }

  function removeTier(index: number) {
    if (input.tiers.length <= 2) return;
    setInput((prev) => {
      const removed = prev.tiers[index];
      const remaining = prev.tiers.filter((_, i) => i !== index);
      // Redistribute removed tier's traffic proportionally
      const remainingTotal = remaining.reduce((s, t) => s + t.trafficPct, 0);
      const newTiers = remaining.map((t) => ({
        ...t,
        trafficPct: remainingTotal > 0
          ? t.trafficPct + (removed.trafficPct * t.trafficPct) / remainingTotal
          : 1 / remaining.length,
      }));
      return { ...prev, tiers: newTiers };
    });
  }

  function handleModelChange(index: number, modelId: string) {
    const model = getModel(modelId);
    if (!model) return;
    // Auto-estimate cost per request using current tokenCost tokens or defaults
    const inTok = tokenCost?.inputTokens ?? 1000;
    const outTok = tokenCost?.outputTokens ?? 500;
    const cost = estimateCostPerRequest(modelId, inTok, outTok);
    updateTier(index, { modelId, costPerRequest: cost });
  }

  // Chart data: stacked bar
  const stackedBarData = [
    {
      name: "Cascade",
      classifier: output.classifierCost,
      ...Object.fromEntries(
        output.tierCosts.map((tc, i) => [`tier${i}`, tc.cost])
      ),
    },
    {
      name: "All Premium",
      classifier: 0,
      allPremium: output.allExpensiveCost,
    },
  ];

  // Per-tier breakdown table rows
  const tableRows = output.tierCosts.map((tc, i) => {
    const tier = input.tiers[i];
    const model = getModel(tier.modelId);
    return {
      tier: `Tier ${i + 1}`,
      model: model?.name ?? tier.modelId,
      traffic: tier.trafficPct,
      volume: tc.volume,
      costPerReq: tier.costPerRequest,
      monthlyCost: tc.cost,
      quality: tier.qualityScore,
      color: TIER_COLORS[i],
    };
  });

  const tableColumns = [
    {
      key: "tier",
      header: "Tier",
      render: (row: (typeof tableRows)[0]) => (
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: row.color }}
          />
          <span className="text-text-primary">{row.tier}</span>
        </span>
      ),
    },
    {
      key: "model",
      header: "Model",
      render: (row: (typeof tableRows)[0]) => (
        <span className="text-text-secondary">{row.model}</span>
      ),
    },
    {
      key: "traffic",
      header: "Traffic",
      align: "right" as const,
      render: (row: (typeof tableRows)[0]) => (
        <span className="text-text-primary">{formatPct(row.traffic)}</span>
      ),
    },
    {
      key: "volume",
      header: "Volume",
      align: "right" as const,
      render: (row: (typeof tableRows)[0]) => (
        <span className="text-text-primary">{formatNumber(row.volume)}</span>
      ),
    },
    {
      key: "costPerReq",
      header: "Cost/Req",
      align: "right" as const,
      render: (row: (typeof tableRows)[0]) => (
        <span className="text-text-primary">{formatCurrency(row.costPerReq, 6)}</span>
      ),
    },
    {
      key: "monthlyCost",
      header: "Monthly",
      align: "right" as const,
      render: (row: (typeof tableRows)[0]) => (
        <span className="text-text-primary">{formatCurrency(row.monthlyCost, 2)}</span>
      ),
    },
    {
      key: "quality",
      header: "Quality",
      align: "right" as const,
      render: (row: (typeof tableRows)[0]) => (
        <span className="text-text-primary">{row.quality}%</span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Cascade Routing Calculator
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Module 2.4: Route requests to tiered models by complexity. Estimate blended cost, quality, and savings vs single-model.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left panel: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          {/* Volume + Classifier */}
          <Card>
            <CardHeader>
              <CardTitle>Volume & Classifier</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Total requests / month"
                value={input.totalRequestsPerMonth}
                onChange={(v) => {
                  setInput((prev) => ({
                    ...prev,
                    totalRequestsPerMonth: Math.max(0, v),
                  }));
                  markOverride("totalRequestsPerMonth");
                }}
                min={0}
                step={10000}
                syncSource={getSyncSource("totalRequestsPerMonth") ?? undefined}
                onSyncReset={isFieldOverridden("totalRequestsPerMonth") ? () => resetField("totalRequestsPerMonth") : undefined}
              />
              <SelectInput
                label="Classifier model"
                value={input.classifierModelId}
                onChange={(v) => {
                  const cost = estimateCostPerRequest(
                    v,
                    (tokenCost?.inputTokens ?? 1000) * 0.1,
                    (tokenCost?.outputTokens ?? 500) * 0.05
                  );
                  setInput((prev) => ({
                    ...prev,
                    classifierModelId: v,
                    classifierCostPerRequest: cost,
                  }));
                }}
                options={MODEL_OPTIONS_GROUPED}
              />
              <NumberInput
                label="Classifier cost / request"
                value={input.classifierCostPerRequest}
                onChange={(v) =>
                  setInput((prev) => ({
                    ...prev,
                    classifierCostPerRequest: Math.max(0, v),
                  }))
                }
                min={0}
                step={0.00001}
                prefix="$"
                hint="Small model call to classify complexity"
              />
            </div>
          </Card>

          {/* Tiers */}
          {input.tiers.map((tier, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: TIER_COLORS[i] }}
                    />
                    <CardTitle>{`Tier ${i + 1}`}</CardTitle>
                  </div>
                  {input.tiers.length > 2 && (
                    <button
                      onClick={() => removeTier(i)}
                      className="text-xs text-text-muted hover:text-negative transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </CardHeader>
              <div className="space-y-3">
                <SelectInput
                  label="Model"
                  value={tier.modelId}
                  onChange={(v) => handleModelChange(i, v)}
                  options={MODEL_OPTIONS_GROUPED}
                />
                <SliderInput
                  label="Traffic share"
                  value={Math.round(tier.trafficPct * 100)}
                  onChange={(v) => updateTrafficPct(i, v / 100)}
                  min={0}
                  max={100}
                  step={1}
                  formatValue={(v) => `${v}%`}
                />
                <NumberInput
                  label="Cost / request"
                  value={tier.costPerRequest}
                  onChange={(v) => updateTier(i, { costPerRequest: Math.max(0, v) })}
                  min={0}
                  step={0.0001}
                  prefix="$"
                />
                <SliderInput
                  label="Quality score"
                  value={tier.qualityScore}
                  onChange={(v) => updateTier(i, { qualityScore: v })}
                  min={0}
                  max={100}
                  step={1}
                  formatValue={(v) => `${v}%`}
                />
              </div>
            </Card>
          ))}

          <button
              onClick={addTier}
              className="w-full py-2 text-xs font-medium rounded border border-dashed border-border text-text-muted hover:text-text-primary hover:border-border-hover transition-colors"
            >
              + Add Tier
            </button>

          {/* Traffic sum warning */}
          {(() => {
            const sum = input.tiers.reduce((s, t) => s + t.trafficPct, 0);
            const isOff = Math.abs(sum - 1) > 0.001;
            return (
              <div className={`text-[10px] text-center font-mono ${isOff ? "text-negative" : "text-text-muted"}`}>
                Traffic sum: {formatPct(sum)}
                {isOff && " — must equal 100%"}
              </div>
            );
          })()}
        </div>

        {/* Right panel: Outputs */}
        <div className="lg:col-span-8 space-y-4">
          {/* Key metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Cascade Metrics</CardTitle>
              <CardDescription>Blended performance across all tiers</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Blended Cost / Req"
                value={formatCurrency(output.blendedCostPerRequest, 6)}
              />
              <StatCard
                label="Total Monthly"
                value={formatCurrency(output.totalMonthlyCost, 2)}
                subValue={`${formatNumber(input.totalRequestsPerMonth)} requests`}
              />
              <StatCard
                label="Blended Quality"
                value={`${output.blendedQuality.toFixed(1)}%`}
                variant={output.blendedQuality >= 85 ? "positive" : output.blendedQuality >= 70 ? "default" : "caution"}
              />
              <StatCard
                label="Savings vs Premium"
                value={formatPct(output.savingsVsExpensive)}
                variant={output.savingsVsExpensive > 0.3 ? "positive" : output.savingsVsExpensive > 0.1 ? "default" : "caution"}
                subValue={`vs ${formatCurrency(output.allExpensiveCost, 2)} all-premium`}
              />
            </div>
          </Card>

          {/* Cost detail */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Classifier overhead</span>
                <span className="font-mono text-text-primary">
                  {formatCurrency(output.classifierCost, 2)}
                </span>
              </div>
              {output.tierCosts.map((tc, i) => {
                const model = getModel(input.tiers[i].modelId);
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-sm"
                        style={{ backgroundColor: TIER_COLORS[i] }}
                      />
                      <span className="text-text-secondary">
                        {model?.name ?? input.tiers[i].modelId} ({formatPct(input.tiers[i].trafficPct)})
                      </span>
                    </span>
                    <span className="font-mono text-text-primary">
                      {formatCurrency(tc.cost, 2)}
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span className="text-text-primary">Total monthly</span>
                <span className="font-mono text-accent">
                  {formatCurrency(output.totalMonthlyCost, 2)}
                </span>
              </div>
            </div>
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stacked bar: cost by tier */}
            <Card>
              <CardHeader>
                <CardTitle>Cost by Tier</CardTitle>
                <CardDescription>Monthly cost breakdown per tier</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stackedBarData}
                    margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#999999" }}
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999999" }}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`}
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
                      formatter={(value, name) => {
                        const label =
                          name === "classifier"
                            ? "Classifier"
                            : name === "allPremium"
                              ? "All Premium"
                              : `Tier ${Number(String(name).replace("tier", "")) + 1}`;
                        return [formatCurrency(Number(value), 2), String(label)];
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px" }}
                      formatter={(value: string) => {
                        if (value === "classifier") return "Classifier";
                        if (value === "allPremium") return "All Premium";
                        const idx = Number(value.replace("tier", ""));
                        return `Tier ${idx + 1}`;
                      }}
                    />
                    <Bar
                      dataKey="classifier"
                      stackId="a"
                      fill="#666666"
                      radius={[0, 0, 0, 0]}
                    />
                    {output.tierCosts.map((_, i) => (
                      <Bar
                        key={`tier${i}`}
                        dataKey={`tier${i}`}
                        stackId="a"
                        fill={TIER_COLORS[i]}
                        radius={
                          i === output.tierCosts.length - 1
                            ? [3, 3, 0, 0]
                            : [0, 0, 0, 0]
                        }
                      />
                    ))}
                    <Bar
                      dataKey="allPremium"
                      stackId="a"
                      fill="#666666"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Comparison bar: cascade vs single models */}
            <Card>
              <CardHeader>
                <CardTitle>Cascade vs Single Model</CardTitle>
                <CardDescription>Monthly cost comparison</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Cascade", cost: output.totalMonthlyCost },
                      ...input.tiers.map((tier) => {
                        const model = getModel(tier.modelId);
                        return {
                          name: model?.name.split(" ").slice(0, 2).join(" ") ?? tier.modelId,
                          cost: input.totalRequestsPerMonth * tier.costPerRequest,
                        };
                      }),
                    ]}
                    margin={{ top: 8, right: 8, bottom: 32, left: 8 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "#999999" }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                      axisLine={{ stroke: "#2A2A2A" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999999" }}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`}
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
                      formatter={(value) => [formatCurrency(Number(value), 2), "Monthly"]}
                      itemStyle={{ color: "#E5E5E5" }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="cost" radius={[3, 3, 0, 0]}>
                      {[
                        { name: "Cascade" },
                        ...input.tiers.map((t) => ({ name: t.modelId })),
                      ].map((entry, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? "#4F7FFF" : TIER_COLORS[(i - 1) % TIER_COLORS.length]}
                          opacity={i === 0 ? 1 : 0.5}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Per-tier breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Tier Breakdown</CardTitle>
              <CardDescription>
                {formatNumber(input.totalRequestsPerMonth)} total requests routed across{" "}
                {input.tiers.length} tiers
              </CardDescription>
            </CardHeader>
            <DataTable columns={tableColumns} data={tableRows} />
          </Card>
        </div>
      </div>
    </div>
  );
}
