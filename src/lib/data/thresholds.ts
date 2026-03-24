// Margin zone classification (Block 06, section 10)
export type MarginZone = "healthy" | "monitor" | "action" | "critical";

export function getMarginZone(grossMarginPct: number): MarginZone {
  if (grossMarginPct > 70) return "healthy";
  if (grossMarginPct > 60) return "monitor";
  if (grossMarginPct > 50) return "action";
  return "critical";
}

export const MARGIN_ZONES: { zone: MarginZone; min: number; label: string; action: string }[] = [
  { zone: "healthy", min: 70, label: "Healthy", action: "Invest in features" },
  { zone: "monitor", min: 60, label: "Monitor", action: "Weekly cost review" },
  { zone: "action", min: 50, label: "Action needed", action: "Optimize or re-price" },
  { zone: "critical", min: 0, label: "Critical", action: "Immediate intervention" },
];

// UX latency thresholds (Block 04, section 04)
export type LatencyZone = "instant" | "comfortable" | "tolerable" | "abandonment";

export function getLatencyZone(perceivedMs: number): LatencyZone {
  if (perceivedMs < 200) return "instant";
  if (perceivedMs < 1000) return "comfortable";
  if (perceivedMs < 3000) return "tolerable";
  return "abandonment";
}

export const LATENCY_ZONES: { zone: LatencyZone; maxMs: number; label: string; fit: string }[] = [
  { zone: "instant", maxMs: 200, label: "Instant", fit: "Autocomplete, edge models, cache hits" },
  { zone: "comfortable", maxMs: 1000, label: "Comfortable", fit: "P95 target for user-facing apps" },
  { zone: "tolerable", maxMs: 3000, label: "Tolerable", fit: "Complex reasoning, with streaming" },
  { zone: "abandonment", maxMs: Infinity, label: "Abandonment", fit: "Conversion drops, tab-switching" },
];

// Constants
export const EMBEDDING_COST_PER_MTOK = 0.02;
export const INFRA_OVERHEAD_PCT_RANGE: [number, number] = [0.15, 0.25];
export const OUTPUT_INPUT_PRICE_RATIO_MEDIAN = 4.5;
export const AGENT_CONTEXT_GROWTH_PER_STEP = 2000; // tokens
export const BUDGET_CAP_MULTIPLIER = 8; // ~8x baseline
