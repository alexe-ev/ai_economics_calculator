"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Coins,
  Layers,
  GitBranch,
  Bot,
  PieChart,
  FileText,
  ChevronRight,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Cost Basics",
    items: [
      { href: "/calculator/token-cost", label: "Token Cost", icon: Coins, module: "2.1" },
    ],
  },
  {
    label: "Optimization",
    items: [
      { href: "/calculator/optimization-stack", label: "Optimization Stack", icon: Layers, module: "2.2" },
    ],
  },
  {
    label: "Model Selection",
    items: [
      { href: "/calculator/cascade-routing", label: "Cascade Routing", icon: GitBranch, module: "2.4" },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/calculator/agent-cost", label: "Agent Cost", icon: Bot, module: "2.7" },
    ],
  },
  {
    label: "Unit Economics",
    items: [
      { href: "/calculator/unit-economics", label: "Unit Economics", icon: PieChart, module: "2.9" },
    ],
  },
  {
    label: "PM Tools",
    items: [
      { href: "/calculator/economics-brief", label: "Economics Brief", icon: FileText, module: "2.13" },
    ],
  },
];

// Data flow connections between modules
const DATA_FLOWS: Record<string, string[]> = {
  "/calculator/token-cost": ["/calculator/optimization-stack", "/calculator/cascade-routing"],
  "/calculator/optimization-stack": ["/calculator/cascade-routing", "/calculator/unit-economics"],
  "/calculator/cascade-routing": ["/calculator/agent-cost"],
  "/calculator/agent-cost": ["/calculator/unit-economics"],
  "/calculator/unit-economics": ["/calculator/economics-brief"],
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const downstreamModules = DATA_FLOWS[pathname] || [];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h1 className="text-sm font-semibold text-text-primary">
            AI Economics Calculator
          </h1>
          <p className="text-xs text-text-muted mt-1">SNAPSHOT: March 2026</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-text-muted font-medium">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const isDownstream = downstreamModules.includes(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-accent/10 text-accent border-r-2 border-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    )}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] text-text-muted">{item.module}</span>
                    {isDownstream && (
                      <ChevronRight size={12} className="text-accent/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
