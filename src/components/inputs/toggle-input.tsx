"use client";

import { cn } from "@/lib/utils";

interface ToggleInputProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ToggleInput({
  label,
  checked,
  onChange,
  className,
}: ToggleInputProps) {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer", className)}>
      <div
        className={cn(
          "relative w-8 h-4 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-border"
        )}
        onClick={() => onChange(!checked)}
      >
        <div
          className={cn(
            "absolute top-0.5 w-3 h-3 rounded-full bg-text-primary transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </div>
      <span className="text-xs text-text-secondary">{label}</span>
    </label>
  );
}
