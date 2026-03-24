"use client";

import { cn } from "@/lib/utils";

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  className,
}: SelectInputProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
