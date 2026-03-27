"use client";

import { cn } from "@/lib/utils";

interface OptionGroup {
  group: string;
  options: { value: string; label: string }[];
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[] | OptionGroup[];
  className?: string;
  syncSource?: string;
  onSyncReset?: () => void;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  className,
  syncSource,
  onSyncReset,
}: SelectInputProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-primary border border-border rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
      >
        {options.length > 0 && "group" in options[0]
          ? (options as OptionGroup[]).map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))
          : (options as { value: string; label: string }[]).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
      </select>
      {syncSource && (
        <p className="text-[10px] text-accent flex items-center gap-1">
          <span>from {syncSource}</span>
          {onSyncReset && (
            <button
              type="button"
              onClick={onSyncReset}
              className="text-text-muted hover:text-text-primary underline"
            >
              reset
            </button>
          )}
        </p>
      )}
      {!syncSource && onSyncReset && (
        <p className="text-[10px] text-text-muted">
          <button
            type="button"
            onClick={onSyncReset}
            className="hover:text-text-primary underline"
          >
            sync from upstream
          </button>
        </p>
      )}
    </div>
  );
}
