import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: "default" | "positive" | "negative" | "caution";
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  variant = "default",
  className,
}: StatCardProps) {
  const variantColors = {
    default: "text-text-primary",
    positive: "text-positive",
    negative: "text-negative",
    caution: "text-caution",
  };

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn("text-lg font-mono font-semibold", variantColors[variant])}>
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] text-text-muted">{subValue}</p>
      )}
    </div>
  );
}
