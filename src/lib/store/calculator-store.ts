import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SharedCalculatorState } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/constants";

interface CalculatorStore extends SharedCalculatorState {
  setTokenCost: (data: SharedCalculatorState["tokenCost"]) => void;
  setOptimization: (data: SharedCalculatorState["optimization"]) => void;
  setCascadeRouting: (data: SharedCalculatorState["cascadeRouting"]) => void;
  setAgentCost: (data: SharedCalculatorState["agentCost"]) => void;
  setUnitEconomics: (data: SharedCalculatorState["unitEconomics"]) => void;
}

export const useCalculatorStore = create<CalculatorStore>()(
  persist(
    (set) => ({
      tokenCost: undefined,
      optimization: undefined,
      cascadeRouting: undefined,
      agentCost: undefined,
      unitEconomics: undefined,
      setTokenCost: (data) => set({ tokenCost: data }),
      setOptimization: (data) => set({ optimization: data }),
      setCascadeRouting: (data) => set({ cascadeRouting: data }),
      setAgentCost: (data) => set({ agentCost: data }),
      setUnitEconomics: (data) => set({ unitEconomics: data }),
    }),
    {
      name: STORAGE_KEYS.zustand,
    }
  )
);
