"use client";

import { useState, useMemo, useCallback } from "react";
import { useFieldSync } from "@/lib/hooks/use-field-sync";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { EconomicsBriefInput } from "@/lib/types";
import { MODEL_PRICES, getModel } from "@/lib/data/models";
import { generateEconomicsBrief } from "@/lib/calculations/economics-brief";
import { useCalculatorStore } from "@/lib/store/calculator-store";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatCurrency, formatPct } from "@/lib/utils";
import { NumberInput } from "@/components/inputs/number-input";
import { SelectInput } from "@/components/inputs/select-input";
import { StatCard } from "@/components/outputs/stat-card";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const MODEL_OPTIONS = MODEL_PRICES.map((m) => ({
  value: m.id,
  label: `${m.name} (${m.provider})`,
}));

const DEFAULT_INPUT: EconomicsBriefInput = {
  taskDescription: "",
  inputTokens: 1000,
  outputTokens: 500,
  requestsPerDay: 333,
  requestsPerMonth: 333 * 30,
  modelId: "claude-sonnet",
  modelReason: "",
  costPerRequest: 0,
  monthlyCost: 0,
  humanCostPerUnit: 5.0,
};

export default function EconomicsBriefPage() {
  const [input, setInput] = usePersistedState<EconomicsBriefInput>(STORAGE_KEYS.economicsBrief, DEFAULT_INPUT);
  const [monthlyManualOverride, setMonthlyManualOverride] = useState(false);
  const [costManualOverride, setCostManualOverride] = useState(false);
  const [monthlyCostManualOverride, setMonthlyCostManualOverride] = useState(false);
  const [copied, setCopied] = useState(false);

  const tokenCost = useCalculatorStore((s) => s.tokenCost);
  const unitEconomics = useCalculatorStore((s) => s.unitEconomics);

  const syncConfig = useMemo(() => [
    { field: "inputTokens", upstream: () => tokenCost?.inputTokens, source: "Token Cost" },
    { field: "outputTokens", upstream: () => tokenCost?.outputTokens, source: "Token Cost" },
    { field: "modelId", upstream: () => tokenCost?.modelId, source: "Token Cost" },
    { field: "humanCostPerUnit", upstream: () => unitEconomics?.humanCostPerOutcome, source: "Unit Economics" },
  ], [tokenCost, unitEconomics]);

  const { markOverride, resetField, getSyncSource, isFieldOverridden } = useFieldSync(
    input,
    setInput,
    syncConfig,
    STORAGE_KEYS.economicsBriefOverrides,
  );

  const model = getModel(input.modelId);

  // Auto-calculate requests per month from daily (unless manually overridden)
  const effectiveRequestsPerMonth = monthlyManualOverride
    ? input.requestsPerMonth
    : input.requestsPerDay * 30;

  // Auto-calculate cost per request from model + tokens (unless manually overridden)
  const autoCostPerRequest = model
    ? (input.inputTokens / 1_000_000) * model.inputPricePerMTok +
      (input.outputTokens / 1_000_000) * model.outputPricePerMTok
    : 0;

  const effectiveCostPerRequest = costManualOverride
    ? input.costPerRequest
    : autoCostPerRequest;

  // Auto-calculate monthly cost (unless manually overridden)
  const autoMonthlyCost = effectiveCostPerRequest * effectiveRequestsPerMonth;
  const effectiveMonthlyCost = monthlyCostManualOverride
    ? input.monthlyCost
    : autoMonthlyCost;

  const output = useMemo(
    () =>
      generateEconomicsBrief({
        ...input,
        requestsPerMonth: effectiveRequestsPerMonth,
        costPerRequest: effectiveCostPerRequest,
        monthlyCost: effectiveMonthlyCost,
      }),
    [input, effectiveRequestsPerMonth, effectiveCostPerRequest, effectiveMonthlyCost]
  );

  function update<K extends keyof EconomicsBriefInput>(
    key: K,
    value: EconomicsBriefInput[K]
  ) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(output.brief).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [output.brief]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">
          Pre-Launch Economics Brief
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Module 2.13: Generate a structured economics brief for AI feature launches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left panel: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          {/* Task */}
          <Card>
            <CardHeader>
              <CardTitle>Task</CardTitle>
            </CardHeader>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">
                Task description
              </label>
              <textarea
                value={input.taskDescription}
                onChange={(e) => update("taskDescription", e.target.value)}
                placeholder="Customer support chatbot for SaaS product"
                rows={3}
                className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none resize-none"
              />
            </div>
          </Card>

          {/* Tokens */}
          <Card>
            <CardHeader>
              <CardTitle>Token Estimates</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Input tokens"
                value={input.inputTokens}
                onChange={(v) => { update("inputTokens", Math.max(0, v)); markOverride("inputTokens"); }}
                min={0}
                step={100}
                suffix="tokens"
                syncSource={getSyncSource("inputTokens") ?? undefined}
                onSyncReset={isFieldOverridden("inputTokens") ? () => resetField("inputTokens") : undefined}
              />
              <NumberInput
                label="Output tokens"
                value={input.outputTokens}
                onChange={(v) => { update("outputTokens", Math.max(0, v)); markOverride("outputTokens"); }}
                min={0}
                step={100}
                suffix="tokens"
                syncSource={getSyncSource("outputTokens") ?? undefined}
                onSyncReset={isFieldOverridden("outputTokens") ? () => resetField("outputTokens") : undefined}
              />
            </div>
          </Card>

          {/* Volume */}
          <Card>
            <CardHeader>
              <CardTitle>Volume</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <NumberInput
                label="Requests per day"
                value={input.requestsPerDay}
                onChange={(v) => {
                  update("requestsPerDay", Math.max(0, v));
                  if (!monthlyManualOverride) {
                    update("requestsPerMonth", Math.max(0, v) * 30);
                  }
                }}
                min={0}
                step={10}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">
                    Requests per month
                  </label>
                  {!monthlyManualOverride && (
                    <span className="text-[10px] text-text-muted">
                      auto: daily x 30
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={effectiveRequestsPerMonth}
                  onChange={(e) => {
                    setMonthlyManualOverride(true);
                    update("requestsPerMonth", Math.max(0, Number(e.target.value)));
                  }}
                  min={0}
                  step={1000}
                  className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary focus:border-accent focus:outline-none"
                />
                {monthlyManualOverride && (
                  <button
                    onClick={() => {
                      setMonthlyManualOverride(false);
                      update("requestsPerMonth", input.requestsPerDay * 30);
                    }}
                    className="text-[10px] text-accent hover:text-accent-hover"
                  >
                    Reset to auto
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Model */}
          <Card>
            <CardHeader>
              <CardTitle>Model</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <SelectInput
                label="Model"
                value={input.modelId}
                onChange={(v) => {
                  update("modelId", v);
                  markOverride("modelId");
                  setCostManualOverride(false);
                  setMonthlyCostManualOverride(false);
                }}
                options={MODEL_OPTIONS}
                syncSource={getSyncSource("modelId") ?? undefined}
                onSyncReset={isFieldOverridden("modelId") ? () => resetField("modelId") : undefined}
              />
              {model && (
                <div className="text-[10px] text-text-muted font-mono">
                  Input: ${model.inputPricePerMTok}/MTok · Output: $
                  {model.outputPricePerMTok}/MTok
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">
                  Model selection reason
                </label>
                <input
                  type="text"
                  value={input.modelReason}
                  onChange={(e) => update("modelReason", e.target.value)}
                  placeholder="Best quality/cost balance for support"
                  className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Costs */}
          <Card>
            <CardHeader>
              <CardTitle>Costs</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">
                    Cost per request
                  </label>
                  {!costManualOverride && (
                    <span className="text-[10px] text-text-muted">auto</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-muted">$</span>
                  <input
                    type="number"
                    value={
                      costManualOverride
                        ? input.costPerRequest
                        : Number(autoCostPerRequest.toFixed(6))
                    }
                    onChange={(e) => {
                      setCostManualOverride(true);
                      update("costPerRequest", Math.max(0, Number(e.target.value)));
                    }}
                    min={0}
                    step={0.000001}
                    className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
                {costManualOverride && (
                  <button
                    onClick={() => setCostManualOverride(false)}
                    className="text-[10px] text-accent hover:text-accent-hover"
                  >
                    Reset to auto
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">
                    Monthly cost
                  </label>
                  {!monthlyCostManualOverride && (
                    <span className="text-[10px] text-text-muted">auto</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-muted">$</span>
                  <input
                    type="number"
                    value={
                      monthlyCostManualOverride
                        ? input.monthlyCost
                        : Number(autoMonthlyCost.toFixed(2))
                    }
                    onChange={(e) => {
                      setMonthlyCostManualOverride(true);
                      update("monthlyCost", Math.max(0, Number(e.target.value)));
                    }}
                    min={0}
                    step={1}
                    className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
                {monthlyCostManualOverride && (
                  <button
                    onClick={() => setMonthlyCostManualOverride(false)}
                    className="text-[10px] text-accent hover:text-accent-hover"
                  >
                    Reset to auto
                  </button>
                )}
              </div>

              <NumberInput
                label="Human cost per unit"
                value={input.humanCostPerUnit}
                onChange={(v) => { update("humanCostPerUnit", Math.max(0, v)); markOverride("humanCostPerUnit"); }}
                min={0}
                step={0.5}
                prefix="$"
                hint="Cost of human handling one request"
                syncSource={getSyncSource("humanCostPerUnit") ?? undefined}
                onSyncReset={isFieldOverridden("humanCostPerUnit") ? () => resetField("humanCostPerUnit") : undefined}
              />
            </div>
          </Card>
        </div>

        {/* Right panel: Output */}
        <div className="lg:col-span-8 space-y-4">
          {/* Warning banner */}
          {output.unknownFieldsCount > 2 && (
            <div className="rounded-lg border border-caution/40 bg-caution/10 px-4 py-3">
              <p className="text-xs text-caution font-medium">
                {output.unknownFieldsCount} fields are empty or zero. Fill them
                in for a complete brief.
              </p>
            </div>
          )}

          {/* Key metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Cost / Request"
                value={formatCurrency(effectiveCostPerRequest, 6)}
              />
              <StatCard
                label="Monthly Cost"
                value={formatCurrency(effectiveMonthlyCost, 2)}
                subValue={`${effectiveRequestsPerMonth.toLocaleString()} requests`}
              />
              <StatCard
                label="AI / Human Ratio"
                value={
                  output.aiToHumanRatio > 0
                    ? formatPct(output.aiToHumanRatio)
                    : "N/A"
                }
                variant={
                  output.aiToHumanRatio > 0 && output.aiToHumanRatio < 0.1
                    ? "positive"
                    : output.aiToHumanRatio >= 1
                      ? "negative"
                      : "default"
                }
                subValue={
                  output.aiToHumanRatio > 0
                    ? `$${effectiveCostPerRequest.toFixed(4)} vs $${input.humanCostPerUnit.toFixed(2)}`
                    : undefined
                }
              />
              <StatCard
                label="Break-even"
                value={
                  output.breakEvenVolume === 1
                    ? "From #1"
                    : output.breakEvenVolume === 0 &&
                        effectiveCostPerRequest >= input.humanCostPerUnit &&
                        input.humanCostPerUnit > 0
                      ? "Never"
                      : "N/A"
                }
                variant={
                  output.breakEvenVolume === 1
                    ? "positive"
                    : output.breakEvenVolume === 0 &&
                        effectiveCostPerRequest >= input.humanCostPerUnit
                      ? "negative"
                      : "default"
                }
              />
            </div>
          </Card>

          {/* Brief output */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Economics Brief</CardTitle>
                  <CardDescription>
                    Copy and paste into your launch doc or PRD
                  </CardDescription>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  {copied ? "Copied" : "Copy to clipboard"}
                </button>
              </div>
            </CardHeader>
            <pre className="rounded-lg border border-border bg-[#0F0F0F] p-4 text-sm font-mono text-text-primary leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {output.brief.split("\n").map((line, i) => (
                <BriefLine key={i} line={line} />
              ))}
            </pre>
          </Card>

          {/* AI vs Human comparison */}
          <Card>
            <CardHeader>
              <CardTitle>AI vs Human Comparison</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">AI cost per request</span>
                <span className="font-mono text-text-primary">
                  {formatCurrency(effectiveCostPerRequest, 6)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Human cost per unit</span>
                <span className="font-mono text-text-primary">
                  {formatCurrency(input.humanCostPerUnit, 2)}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="text-text-secondary">Ratio (AI / Human)</span>
                <span className="font-mono text-accent">
                  {output.aiToHumanRatio > 0
                    ? `${(output.aiToHumanRatio * 100).toFixed(2)}%`
                    : "N/A"}
                </span>
              </div>
              {output.aiToHumanRatio > 0 && output.aiToHumanRatio < 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Savings per request</span>
                  <span className="font-mono text-positive">
                    {formatCurrency(
                      input.humanCostPerUnit - effectiveCostPerRequest,
                      4
                    )}
                  </span>
                </div>
              )}
              {output.aiToHumanRatio > 0 && output.aiToHumanRatio < 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    Monthly savings ({effectiveRequestsPerMonth.toLocaleString()} req)
                  </span>
                  <span className="font-mono text-positive">
                    {formatCurrency(
                      (input.humanCostPerUnit - effectiveCostPerRequest) *
                        effectiveRequestsPerMonth,
                      2
                    )}
                  </span>
                </div>
              )}
              {/* Visual ratio bar */}
              {output.aiToHumanRatio > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-[10px] text-text-muted mb-1">
                    <span>AI</span>
                    <div className="flex-1" />
                    <span>Human</span>
                  </div>
                  <div className="relative h-6 rounded bg-border/50 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-accent/60"
                      style={{
                        width: `${Math.min(output.aiToHumanRatio * 100, 100)}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-text-primary">
                      {(output.aiToHumanRatio * 100).toFixed(1)}% of human cost
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Renders a single brief line, highlighting numbers in accent color. */
function BriefLine({ line }: { line: string }) {
  // Split on number-like patterns (including $amounts and percentages)
  const parts = line.split(/(\$[\d,.]+%?|\d[\d,.]*%?)/g);
  return (
    <span className="block">
      {parts.map((part, i) =>
        /^(\$[\d,.]+%?|\d[\d,.]*%?)$/.test(part) ? (
          <span key={i} className="text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
