import { ModelPricing } from "@/lib/types";

export const MODEL_PRICES: ModelPricing[] = [
  {
    id: "gemini-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    provider: "Google",
    inputPricePerMTok: 0.10,
    outputPricePerMTok: 0.40,
    contextWindow: 1_000_000,
    snapshotDate: "2026-03",
  },
  {
    id: "grok-fast",
    name: "Grok 4.1 Fast",
    provider: "xAI",
    inputPricePerMTok: 0.20,
    outputPricePerMTok: 0.50,
    contextWindow: 2_000_000,
    snapshotDate: "2026-03",
  },
  {
    id: "gemini-flash",
    name: "Gemini 3 Flash",
    provider: "Google",
    inputPricePerMTok: 0.50,
    outputPricePerMTok: 3.00,
    contextWindow: 1_000_000,
    snapshotDate: "2026-03",
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    inputPricePerMTok: 1.00,
    outputPricePerMTok: 5.00,
    contextWindow: 200_000,
    snapshotDate: "2026-03",
  },
  {
    id: "gpt-5-2",
    name: "GPT-5.2",
    provider: "OpenAI",
    inputPricePerMTok: 1.75,
    outputPricePerMTok: 14.00,
    contextWindow: 400_000,
    snapshotDate: "2026-03",
  },
  {
    id: "gemini-pro",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    inputPricePerMTok: 2.00,
    outputPricePerMTok: 12.00,
    contextWindow: 200_000,
    snapshotDate: "2026-03",
  },
  {
    id: "gpt-5-4",
    name: "GPT-5.4",
    provider: "OpenAI",
    inputPricePerMTok: 2.50,
    outputPricePerMTok: 15.00,
    contextWindow: 1_000_000,
    snapshotDate: "2026-03",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    inputPricePerMTok: 3.00,
    outputPricePerMTok: 15.00,
    contextWindow: 200_000,
    snapshotDate: "2026-03",
  },
  {
    id: "claude-opus",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    inputPricePerMTok: 5.00,
    outputPricePerMTok: 25.00,
    contextWindow: 200_000,
    snapshotDate: "2026-03",
  },
];

export const LANGUAGE_MULTIPLIERS: Record<string, number> = {
  en: 1.0,
  ru: 1.5,
  zh: 2.0,
  ar: 1.8,
  other: 1.5,
};

export function getModel(id: string): ModelPricing | undefined {
  return MODEL_PRICES.find((m) => m.id === id);
}

// Model options grouped by provider, sorted alphabetically
export const MODEL_OPTIONS_GROUPED = (() => {
  const byProvider = new Map<string, { value: string; label: string }[]>();
  for (const m of MODEL_PRICES) {
    const group = byProvider.get(m.provider) ?? [];
    group.push({ value: m.id, label: m.name });
    byProvider.set(m.provider, group);
  }
  return Array.from(byProvider.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, options]) => ({ group: provider, options }));
})();
