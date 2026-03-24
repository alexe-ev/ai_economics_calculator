"use client";

import { cn } from "@/lib/utils";

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  hint?: string;
  className?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
  hint,
  className,
}: NumberInputProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-text-secondary">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && (
          <span className="text-xs text-text-muted">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary focus:border-accent focus:outline-none"
        />
        {suffix && (
          <span className="text-xs text-text-muted whitespace-nowrap">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-[10px] text-text-muted">{hint}</p>}
    </div>
  );
}
