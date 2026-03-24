"use client";

import { useEffect, useMemo } from "react";
import { useFieldSync } from "@/lib/hooks/use-field-sync";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { UnitEconomicsInput, UserSegment, SegmentAnalysis } from "@/lib/types";
import { calculateUnitEconomics } from "@/lib/calculations/unit-economics";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { STORAGE_KEYS } from "@/lib/constants";
import { MARGIN_ZONES } from "@/lib/data/thresholds";
import { formatCurrency, formatNumber, formatPct, cn } from "@/lib/utils";
import { NumberInput } from "@/components/inputs/number-input";
import { SliderInput } from "@/components/inputs/slider-input";
import { StatCard } from "@/components/outputs/stat-card";
import { DataTable } from "@/components/outputs/data-table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PIE_COLORS = [
  "#4F7FFF", // inference
  "#22C55E", // embedding
  "#F59E0B", // vector DB
  "#A855F7", // monitoring
  "#EC4899", // fine-tuning
  "#EF4444", // error overhead
  "#F97316", // safety overhead
];

const MARGIN_ZONE_COLORS: Record<string, string> = {
  healthy: "#22C55E",
  monitor: "#F59E0B",
  action: "#F97316",
  critical: "#EF4444",
};

const DEFAULT_SEGMENTS: UserSegment[] = [
  { name: "Light", userPct: 0.6, avgRequestsPerMonth: 20, avgCostPerRequest: 0.05 },
  { name: "Regular", userPct: 0.3, avgRequestsPerMonth: 100, avgCostPerRequest: 0.08 },
  { name: "Power", userPct: 0.1, avgRequestsPerMonth: 500, avgCostPerRequest: 0.12 },
];

const DEFAULT_INPUT: UnitEconomicsInput = {
  subscriptionPrice: 49,
  numUsers: 1000,
  inferenceCostMonthly: 5000,
  embeddingCostMonthly: 200,
  vectorDbMonthly: 500,
  monitoringMonthly: 300,
  fineTuningMonthly: 0,
  errorOverheadPct: 0.1,
  safetyOverheadPct: 0.05,
  segments: DEFAULT_SEGMENTS,
  humanCostPerOutcome: 15,
  aiResolutionRate: 0.75,
  totalRequestsPerMonth: 50000,
};

export default function UnitEconomicsPage() {
  const [input, setInput] = usePersistedState<UnitEconomicsInput>(STORAGE_KEYS.unitEconomics, DEFAULT_INPUT);
  const setUnitEconomics = useCalculatorStore((s) => s.setUnitEconomics);
  const tokenCost = useCalculatorStore((s) => s.tokenCost);

  const syncConfig = useMemo(() => [
    { field: "inferenceCostMonthly", upstream: () => tokenCost?.monthlyCost, source: "Token Cost" },
    { field: "totalRequestsPerMonth", upstream: () => tokenCost?.requestsPerMonth, source: "Token Cost" },
  ], [tokenCost]);

  const { markOverride, resetField, getSyncSource, isFieldOverridden } = useFieldSync(
    input,
    setInput,
    syncConfig,
    STORAGE_KEYS.unitEconomicsOverrides,
  );

  const output = useMemo(() => calculateUnitEconomics(input), [input]);

  const mrr = input.subscriptionPrice * input.numUsers;

  useEffect(() => {
    setUnitEconomics({
      cogsPerUser: output.cogsPerUser,
      fleetGrossMargin: output.fleetGrossMargin,
      segments: input.segments,
      humanCostPerOutcome: input.humanCostPerOutcome,
    });
  }, [output, input.segments, input.humanCostPerOutcome, setUnitEconomics]);

  function updateSegment(index: number, patch: Partial<UserSegment>) {
    setInput((prev) => ({
      ...prev,
      segments: prev.segments.map((s, i) =>
        i === index ? { ...s, ...patch } : s
      ),
    }));
  }

  function addSegment() {
    if (input.segments.length >= 4) return;
    setInput((prev) => ({
      ...prev,
      segments: [
        ...prev.segments,
        { name: "New", userPct: 0.1, avgRequestsPerMonth: 50, avgCostPerRequest: 0.06 },
      ],
    }));
  }

  function removeSegment(index: number) {
    if (input.segments.length <= 2) return;
    setInput((prev) => ({
      ...prev,
      segments: prev.segments.filter((_, i) => i !== index),
    }));
  }

  // Pie chart data (filter out zero values)
  const pieData = output.cogsBreakdown.filter((d) => d.amount > 0);

  // Bar chart data: AI vs Human cost
  const outcomeBarData = [
    { name: "AI cost/resolved", cost: output.costPerResolved },
    { name: "Human cost", cost: input.humanCostPerOutcome },
  ];

  // Margin zone variant for StatCard
  const marginVariant =
    output.marginZone === "healthy"
      ? "positive"
      : output.marginZone === "monitor"
        ? "caution"
        : "negative";

  // Segment table columns
  const segmentColumns = [
    {
      key: "name",
      header: "Segment",
      render: (row: SegmentAnalysis) => (
        <span className="text-text-primary font-medium">{row.name}</span>
      ),
    },
    {
      key: "users",
      header: "Users",
      align: "right" as const,
      render: (row: SegmentAnalysis) => (
        <span className="text-text-primary">{formatNumber(row.users)}</span>
      ),
    },
    {
      key: "requests",
      header: "Req/mo",
      align: "right" as const,
      render: (row: SegmentAnalysis) => (
        <span className="text-text-primary">{formatNumber(row.requestsPerMonth)}</span>
      ),
    },
    {
      key: "cogs",
      header: "COGS/user",
      align: "right" as const,
      render: (row: SegmentAnalysis) => (
        <span className="text-text-primary">{formatCurrency(row.cogsPerUser, 2)}</span>
      ),
    },
    {
      key: "margin",
      header: "Margin",
      align: "right" as const,
      render: (row: SegmentAnalysis) => (
        <span
          className={cn(
            "font-semibold",
            row.isNegativeMargin ? "text-negative" : "text-positive"
          )}
        >
          {row.margin.toFixed(1)}%
        </span>
      ),
    },
  ];

  // Margin gauge position (0-100 range mapped to width)
  const gaugeValue = Math.max(0, Math.min(100, output.fleetGrossMargin));
  const currentZone = MARGIN_ZONES.find((z) => z.zone === output.marginZone);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Unit Economics Dashboard
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Module 2.9: Fleet COGS, gross margin analysis, per-segment breakdown, and outcome cost comparison.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left panel: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          {/* Revenue */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Subscription price"
                value={input.subscriptionPrice}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, subscriptionPrice: Math.max(0, v) }))
                }
                min={0}
                step={1}
                prefix="$"
                suffix="/mo"
              />
              <NumberInput
                label="Number of users"
                value={input.numUsers}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, numUsers: Math.max(0, Math.round(v)) }))
                }
                min={0}
                step={100}
              />
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">MRR</label>
                <p className="text-sm font-mono text-text-primary">
                  {formatCurrency(mrr, 2)}
                </p>
              </div>
            </div>
          </Card>

          {/* COGS */}
          <Card>
            <CardHeader>
              <CardTitle>COGS</CardTitle>
              <CardDescription>Monthly cost components</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Inference cost"
                value={input.inferenceCostMonthly}
                onChange={(v) => {
                  setInput((prev) => ({ ...prev, inferenceCostMonthly: Math.max(0, v) }));
                  markOverride("inferenceCostMonthly");
                }}
                min={0}
                step={100}
                prefix="$"
                suffix="/mo"
                syncSource={getSyncSource("inferenceCostMonthly") ?? undefined}
                onSyncReset={isFieldOverridden("inferenceCostMonthly") ? () => resetField("inferenceCostMonthly") : undefined}
              />
              <NumberInput
                label="Embedding cost"
                value={input.embeddingCostMonthly}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, embeddingCostMonthly: Math.max(0, v) }))
                }
                min={0}
                step={50}
                prefix="$"
                suffix="/mo"
              />
              <NumberInput
                label="Vector DB"
                value={input.vectorDbMonthly}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, vectorDbMonthly: Math.max(0, v) }))
                }
                min={0}
                step={50}
                prefix="$"
                suffix="/mo"
              />
              <NumberInput
                label="Monitoring"
                value={input.monitoringMonthly}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, monitoringMonthly: Math.max(0, v) }))
                }
                min={0}
                step={50}
                prefix="$"
                suffix="/mo"
              />
              <NumberInput
                label="Fine-tuning"
                value={input.fineTuningMonthly}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, fineTuningMonthly: Math.max(0, v) }))
                }
                min={0}
                step={100}
                prefix="$"
                suffix="/mo"
              />
              <SliderInput
                label="Error overhead"
                value={input.errorOverheadPct}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, errorOverheadPct: v }))
                }
                min={0}
                max={0.3}
                step={0.01}
                formatValue={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <SliderInput
                label="Safety overhead"
                value={input.safetyOverheadPct}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, safetyOverheadPct: v }))
                }
                min={0}
                max={0.2}
                step={0.01}
                formatValue={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </div>
          </Card>

          {/* User Segments */}
          <Card>
            <CardHeader>
              <CardTitle>User Segments</CardTitle>
              <CardDescription>
                {input.segments.length} segment{input.segments.length !== 1 ? "s" : ""} (2-4)
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              {input.segments.map((seg, i) => (
                <div
                  key={i}
                  className="space-y-2 border border-border rounded p-3"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={seg.name}
                      onChange={(e) => updateSegment(i, { name: e.target.value })}
                      className="bg-transparent text-xs font-semibold text-text-primary border-none outline-none w-24"
                    />
                    {input.segments.length > 2 && (
                      <button
                        onClick={() => removeSegment(i)}
                        className="text-[10px] text-negative hover:text-negative/80 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <NumberInput
                    label="% of users"
                    value={Math.round(seg.userPct * 100)}
                    onChange={(v) =>
                      updateSegment(i, { userPct: Math.max(0, Math.min(100, v)) / 100 })
                    }
                    min={0}
                    max={100}
                    step={5}
                    suffix="%"
                  />
                  <NumberInput
                    label="Avg requests/mo"
                    value={seg.avgRequestsPerMonth}
                    onChange={(v) =>
                      updateSegment(i, { avgRequestsPerMonth: Math.max(0, v) })
                    }
                    min={0}
                    step={10}
                  />
                  <NumberInput
                    label="Avg cost/request"
                    value={seg.avgCostPerRequest}
                    onChange={(v) =>
                      updateSegment(i, { avgCostPerRequest: Math.max(0, v) })
                    }
                    min={0}
                    step={0.01}
                    prefix="$"
                  />
                </div>
              ))}
              {input.segments.length < 4 && (
                <button
                  onClick={addSegment}
                  className="w-full py-1.5 text-xs text-accent border border-border rounded hover:border-accent transition-colors"
                >
                  + Add Segment
                </button>
              )}
            </div>
          </Card>

          {/* Outcome */}
          <Card>
            <CardHeader>
              <CardTitle>Outcome Comparison</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Human cost per outcome"
                value={input.humanCostPerOutcome}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, humanCostPerOutcome: Math.max(0, v) }))
                }
                min={0}
                step={1}
                prefix="$"
              />
              <SliderInput
                label="AI resolution rate"
                value={input.aiResolutionRate}
                onChange={(v) =>
                  setInput((prev) => ({ ...prev, aiResolutionRate: v }))
                }
                min={0.5}
                max={1}
                step={0.01}
                formatValue={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <NumberInput
                label="Total requests/mo"
                value={input.totalRequestsPerMonth}
                onChange={(v) => {
                  setInput((prev) => ({
                    ...prev,
                    totalRequestsPerMonth: Math.max(0, Math.round(v)),
                  }));
                  markOverride("totalRequestsPerMonth");
                }}
                min={0}
                step={1000}
                syncSource={getSyncSource("totalRequestsPerMonth") ?? undefined}
                onSyncReset={isFieldOverridden("totalRequestsPerMonth") ? () => resetField("totalRequestsPerMonth") : undefined}
              />
            </div>
          </Card>
        </div>

        {/* Right panel: Outputs */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top stat cards */}
          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Fleet COGS"
                value={formatCurrency(output.fleetCogs, 2)}
                subValue="per month"
              />
              <StatCard
                label="Fleet Gross Margin"
                value={`${output.fleetGrossMargin.toFixed(1)}%`}
                subValue={currentZone?.label}
                variant={marginVariant}
              />
              <StatCard
                label="COGS / User"
                value={formatCurrency(output.cogsPerUser, 2)}
                subValue="per month"
              />
              <StatCard
                label="Revenue / User"
                value={formatCurrency(output.revenuePerUser, 2)}
                subValue={`MRR: ${formatCurrency(mrr, 2)}`}
              />
            </div>
          </Card>

          {/* Margin zone gauge */}
          <Card>
            <CardHeader>
              <CardTitle>Margin Zone</CardTitle>
              <CardDescription>
                {currentZone?.action}
              </CardDescription>
            </CardHeader>
            <div className="space-y-3">
              {/* Gauge bar */}
              <div className="relative h-6 rounded-full overflow-hidden flex">
                <div className="flex-1 bg-[#EF4444]/30" /> {/* 0-50: critical */}
                <div className="flex-1 bg-[#F97316]/30" /> {/* 50-60: action */}
                <div className="flex-1 bg-[#F59E0B]/30" /> {/* 60-70: monitor */}
                <div className="flex-1 bg-[#22C55E]/30" /> {/* 70-100: healthy */}
              </div>
              {/* Indicator */}
              <div className="relative h-2">
                <div
                  className="absolute top-0 w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1"
                  style={{
                    left: `${gaugeValue}%`,
                    backgroundColor: MARGIN_ZONE_COLORS[output.marginZone],
                  }}
                />
              </div>
              {/* Labels */}
              <div className="flex text-[10px] text-text-muted">
                <div className="flex-1">Critical &lt;50%</div>
                <div className="flex-1 text-center">Action 50-60%</div>
                <div className="flex-1 text-center">Monitor 60-70%</div>
                <div className="flex-1 text-right">Healthy &gt;70%</div>
              </div>
            </div>
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COGS breakdown pie */}
            <Card>
              <CardHeader>
                <CardTitle>COGS Breakdown</CardTitle>
                <CardDescription>Monthly cost composition</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="component"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieData.map((entry, index) => {
                        const originalIndex = output.cogsBreakdown.findIndex(
                          (b) => b.component === entry.component
                        );
                        return (
                          <Cell
                            key={entry.component}
                            fill={PIE_COLORS[originalIndex] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1A1A1A",
                        border: "1px solid #2A2A2A",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#E5E5E5",
                      }}
                      labelStyle={{ color: "#E5E5E5" }}
                      formatter={(value, name) => [
                        formatCurrency(Number(value), 2),
                        String(name),
                      ]}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {output.cogsBreakdown
                  .filter((d) => d.amount > 0)
                  .map((item, i) => {
                    const originalIndex = output.cogsBreakdown.findIndex(
                      (b) => b.component === item.component
                    );
                    return (
                      <div key={item.component} className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[originalIndex] }}
                        />
                        <span className="text-[10px] text-text-secondary truncate">
                          {item.component}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted ml-auto">
                          {(item.pct * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Card>

            {/* Outcome comparison bar chart */}
            <Card>
              <CardHeader>
                <CardTitle>Outcome Cost Comparison</CardTitle>
                <CardDescription>AI resolved vs human cost per outcome</CardDescription>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={outcomeBarData}
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
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
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
                      formatter={(value) => [formatCurrency(Number(value), 2), "Cost"]}
                      itemStyle={{ color: "#E5E5E5" }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                      <Cell fill="#4F7FFF" />
                      <Cell fill="#666666" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Blended + breakeven stats below chart */}
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Blended cost/problem</span>
                  <span className="font-mono text-text-primary">
                    {formatCurrency(output.blendedCostPerProblem, 2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Breakeven resolution rate</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      output.breakevenResolutionRate > 1
                        ? "text-negative"
                        : output.breakevenResolutionRate > input.aiResolutionRate
                          ? "text-caution"
                          : "text-positive"
                    )}
                  >
                    {(output.breakevenResolutionRate * 100).toFixed(1)}%
                  </span>
                </div>
                {output.breakevenResolutionRate > 1 && (
                  <p className="text-[10px] text-negative">
                    AI costs exceed human costs at any resolution rate
                  </p>
                )}
                {output.breakevenResolutionRate <= 1 &&
                  output.breakevenResolutionRate > input.aiResolutionRate && (
                    <p className="text-[10px] text-caution">
                      Current resolution rate is below breakeven
                    </p>
                  )}
              </div>
            </Card>
          </div>

          {/* Per-segment table */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Segment Analysis</CardTitle>
              <CardDescription>
                COGS and margin by user segment (subscription: {formatCurrency(input.subscriptionPrice, 2)}/user)
              </CardDescription>
            </CardHeader>
            <DataTable columns={segmentColumns} data={output.segments} />
          </Card>
        </div>
      </div>
    </div>
  );
}
