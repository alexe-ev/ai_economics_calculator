import { create } from "zustand";
import { SharedCalculatorState } from "@/lib/types";

interface CalculatorStore extends SharedCalculatorState {
  setTokenCost: (data: SharedCalculatorState["tokenCost"]) => void;
  setOptimization: (data: SharedCalculatorState["optimization"]) => void;
  setCascadeRouting: (data: SharedCalculatorState["cascadeRouting"]) => void;
  setAgentCost: (data: SharedCalculatorState["agentCost"]) => void;
  setUnitEconomics: (data: SharedCalculatorState["unitEconomics"]) => void;
}

export const useCalculatorStore = create<CalculatorStore>((set) => ({
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
}));
