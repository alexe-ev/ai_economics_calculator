import { describe, it, expect } from "vitest";
import { calculateUnitEconomics } from "@/lib/calculations/unit-economics";
import { UnitEconomicsInput } from "@/lib/types";

const baseInput: UnitEconomicsInput = {
  subscriptionPrice: 49,
  numUsers: 1000,
  inferenceCostMonthly: 5000,
  embeddingCostMonthly: 200,
  vectorDbMonthly: 500,
  monitoringMonthly: 300,
  fineTuningMonthly: 0,
  errorOverheadPct: 0.1,
  safetyOverheadPct: 0.05,
  totalRequestsPerMonth: 50000,
  humanCostPerOutcome: 15,
  aiResolutionRate: 0.75,
  segments: [
    { name: "Light", userPct: 0.6, avgRequestsPerMonth: 20, avgCostPerRequest: 0.05 },
    { name: "Regular", userPct: 0.3, avgRequestsPerMonth: 100, avgCostPerRequest: 0.08 },
    { name: "Power", userPct: 0.1, avgRequestsPerMonth: 500, avgCostPerRequest: 0.12 },
  ],
};

describe("calculateUnitEconomics", () => {
  const result = calculateUnitEconomics(baseInput);

  describe("Fleet COGS", () => {
    it("calculates base COGS, error overhead, safety overhead, and fleet total", () => {
      // baseCogs = 5000 + 200 + 500 + 300 + 0 = 6000
      // errorOverhead = 6000 * 0.10 = 600
      // safetyOverhead = 6000 * 0.05 = 300
      // fleetCogs = 6000 + 600 + 300 = 6900
      expect(result.fleetCogs).toBe(6900);
    });
  });

  describe("COGS breakdown", () => {
    it("returns 7 components", () => {
      expect(result.cogsBreakdown).toHaveLength(7);
    });

    it("has correct component amounts", () => {
      const map = Object.fromEntries(
        result.cogsBreakdown.map((c) => [c.component, c.amount])
      );
      expect(map["Inference"]).toBe(5000);
      expect(map["Embedding"]).toBe(200);
      expect(map["Vector DB"]).toBe(500);
      expect(map["Monitoring"]).toBe(300);
      expect(map["Fine-tuning"]).toBe(0);
      expect(map["Error overhead"]).toBe(600);
      expect(map["Safety overhead"]).toBe(300);
    });

    it("percentages sum to 100%", () => {
      const sum = result.cogsBreakdown.reduce((acc, c) => acc + c.pct, 0);
      // pct values are fractions (0-1), so sum should be 1.0
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("calculates correct percentages", () => {
      const map = Object.fromEntries(
        result.cogsBreakdown.map((c) => [c.component, c.pct])
      );
      // Inference: 5000/6900 ≈ 0.72464
      expect(map["Inference"]).toBeCloseTo(5000 / 6900, 5);
      // Error overhead: 600/6900 ≈ 0.08696
      expect(map["Error overhead"]).toBeCloseTo(600 / 6900, 5);
    });
  });

  describe("COGS per user", () => {
    it("equals fleetCogs / numUsers", () => {
      // 6900 / 1000 = 6.90
      expect(result.cogsPerUser).toBeCloseTo(6.9, 5);
    });
  });

  describe("Gross margin", () => {
    it("calculates correct gross margin percentage", () => {
      // (49 - 6.90) / 49 * 100 = 42.10 / 49 * 100 ≈ 85.918%
      expect(result.fleetGrossMargin).toBeCloseTo(85.918, 1);
    });

    it("returns 'healthy' zone for ~86% margin", () => {
      expect(result.marginZone).toBe("healthy");
    });

    it("returns correct revenue and profit per user", () => {
      expect(result.revenuePerUser).toBe(49);
      // 49 - 6.90 = 42.10
      expect(result.grossProfitPerUser).toBeCloseTo(42.1, 5);
    });
  });

  describe("Margin zones", () => {
    const makeInput = (price: number): UnitEconomicsInput => ({
      ...baseInput,
      subscriptionPrice: price,
    });

    it("returns 'healthy' for margin > 70%", () => {
      // price=49 → margin ~85.9%
      const r = calculateUnitEconomics(makeInput(49));
      expect(r.marginZone).toBe("healthy");
    });

    it("returns 'monitor' for margin 60-70%", () => {
      // Need: (price - 6.90) / price * 100 in (60, 70]
      // price = 20 → margin = (20 - 6.90)/20*100 = 65.5%
      const r = calculateUnitEconomics(makeInput(20));
      expect(r.fleetGrossMargin).toBeCloseTo(65.5, 1);
      expect(r.marginZone).toBe("monitor");
    });

    it("returns 'action' for margin 50-60%", () => {
      // price = 13 → margin = (13 - 6.90)/13*100 = 46.9% → critical
      // price = 15 → margin = (15 - 6.90)/15*100 = 54.0%
      const r = calculateUnitEconomics(makeInput(15));
      expect(r.fleetGrossMargin).toBeCloseTo(54.0, 1);
      expect(r.marginZone).toBe("action");
    });

    it("returns 'critical' for margin < 50%", () => {
      // price = 10 → margin = (10 - 6.90)/10*100 = 31.0%
      const r = calculateUnitEconomics(makeInput(10));
      expect(r.fleetGrossMargin).toBeCloseTo(31.0, 1);
      expect(r.marginZone).toBe("critical");
    });
  });

  describe("Per-segment analysis", () => {
    it("returns 3 segments", () => {
      expect(result.segments).toHaveLength(3);
    });

    it("calculates correct user counts", () => {
      // Light: round(0.6 * 1000) = 600
      // Regular: round(0.3 * 1000) = 300
      // Power: round(0.1 * 1000) = 100
      expect(result.segments[0].users).toBe(600);
      expect(result.segments[1].users).toBe(300);
      expect(result.segments[2].users).toBe(100);
    });

    it("calculates correct per-segment COGS with overhead", () => {
      // infraPerUser = (500 + 300 + 0) / 1000 = 0.80
      // overheadMultiplier = 1 + 0.10 + 0.05 = 1.15
      //
      // Light:   (20 * 0.05 + 0.80) * 1.15 = (1.00 + 0.80) * 1.15 = 1.80 * 1.15 = 2.07
      // Regular: (100 * 0.08 + 0.80) * 1.15 = (8.00 + 0.80) * 1.15 = 8.80 * 1.15 = 10.12
      // Power:   (500 * 0.12 + 0.80) * 1.15 = (60.00 + 0.80) * 1.15 = 60.80 * 1.15 = 69.92
      expect(result.segments[0].cogsPerUser).toBeCloseTo(2.07, 2);
      expect(result.segments[1].cogsPerUser).toBeCloseTo(10.12, 2);
      expect(result.segments[2].cogsPerUser).toBeCloseTo(69.92, 2);
    });

    it("calculates correct per-segment margins", () => {
      // Light margin:   (49 - 2.07) / 49 * 100 ≈ 95.776%
      // Regular margin: (49 - 10.12) / 49 * 100 ≈ 79.347%
      // Power margin:   (49 - 69.92) / 49 * 100 ≈ -42.694%
      expect(result.segments[0].margin).toBeCloseTo(95.776, 1);
      expect(result.segments[1].margin).toBeCloseTo(79.347, 1);
      expect(result.segments[2].margin).toBeCloseTo(-42.694, 1);
    });
  });

  describe("Negative margin detection", () => {
    it("flags Power segment as negative margin", () => {
      // Power cogsPerUser=69.92 > subscriptionPrice=49
      const power = result.segments.find((s) => s.name === "Power")!;
      expect(power.isNegativeMargin).toBe(true);
    });

    it("does not flag Light and Regular segments", () => {
      const light = result.segments.find((s) => s.name === "Light")!;
      const regular = result.segments.find((s) => s.name === "Regular")!;
      expect(light.isNegativeMargin).toBe(false);
      expect(regular.isNegativeMargin).toBe(false);
    });
  });

  describe("Cost per resolved outcome", () => {
    it("equals fleetCogs / (volume * resolutionRate)", () => {
      // 6900 / (50000 * 0.75) = 6900 / 37500 = 0.184
      expect(result.costPerResolved).toBeCloseTo(0.184, 3);
    });
  });

  describe("Blended cost per problem", () => {
    it("equals (resolutionRate * avgAiCost) + ((1 - resolutionRate) * humanCost)", () => {
      // avgAiCostPerRequest = 6900 / 50000 = 0.138
      // blended = (0.75 * 0.138) + (0.25 * 15) = 0.1035 + 3.75 = 3.8535
      expect(result.blendedCostPerProblem).toBeCloseTo(3.8535, 3);
    });
  });

  describe("Breakeven resolution rate", () => {
    it("equals fleetCogs / (volume * humanCost)", () => {
      // 6900 / (50000 * 15) = 6900 / 750000 = 0.0092
      expect(result.breakevenResolutionRate).toBeCloseTo(0.0092, 4);
    });
  });

  describe("Edge cases", () => {
    it("handles 0 users", () => {
      const r = calculateUnitEconomics({ ...baseInput, numUsers: 0 });
      expect(r.cogsPerUser).toBe(0);
      // fleetCogs is still calculated from cost components
      expect(r.fleetCogs).toBe(6900);
      // Segments should have 0 users
      r.segments.forEach((s) => expect(s.users).toBe(0));
    });

    it("handles 0 requests", () => {
      const r = calculateUnitEconomics({ ...baseInput, totalRequestsPerMonth: 0 });
      expect(r.costPerResolved).toBe(0);
      expect(r.blendedCostPerProblem).toBeCloseTo((1 - 0.75) * 15, 5);
      expect(r.breakevenResolutionRate).toBe(0);
    });

    it("handles 0 subscription price", () => {
      const r = calculateUnitEconomics({ ...baseInput, subscriptionPrice: 0 });
      expect(r.revenuePerUser).toBe(0);
      expect(r.fleetGrossMargin).toBe(0);
      expect(r.grossProfitPerUser).toBeCloseTo(-6.9, 5);
      // All segments should have 0 margin when price is 0
      r.segments.forEach((s) => expect(s.margin).toBe(0));
    });
  });
});
