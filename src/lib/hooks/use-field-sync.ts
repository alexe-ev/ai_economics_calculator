"use client";

import { useEffect, useRef } from "react";
import { usePersistedState } from "./use-persisted-state";

export interface SyncFieldConfig {
  field: string;
  upstream: () => number | string | undefined;
  source: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFieldSync<T extends Record<string, any>>(
  input: T,
  setInput: React.Dispatch<React.SetStateAction<T>>,
  fields: SyncFieldConfig[],
  overrideStorageKey: string,
) {
  const [overrides, setOverrides] = usePersistedState<Record<string, boolean>>(
    overrideStorageKey,
    {}
  );
  const initialized = useRef(false);
  const overridesRef = useRef(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);

  const upstreamKey = fields.map(f => f.upstream()).join(",");

  // On mount and when upstream values change: sync non-overridden fields
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const timer = setTimeout(() => {
        syncFields();
      }, 0);
      return () => clearTimeout(timer);
    }
    syncFields();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamKey]);

  function syncFields() {
    const currentOverrides = overridesRef.current;
    setInput((prev: T) => {
      let updated = { ...prev };
      let changed = false;
      for (const { field, upstream } of fields) {
        const upstreamValue = upstream();
        if (upstreamValue !== undefined && !currentOverrides[field]) {
          if (updated[field] !== upstreamValue) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updated as any)[field] = upstreamValue;
            changed = true;
          }
        }
      }
      return changed ? updated : prev;
    });
  }

  function markOverride(field: string) {
    setOverrides((prev) => ({ ...prev, [field]: true }));
  }

  function resetField(field: string) {
    const config = fields.find(f => f.field === field);
    if (!config) return;
    const upstreamValue = config.upstream();
    if (upstreamValue === undefined) return;

    setOverrides((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setInput((prev: T) => ({ ...prev, [field]: upstreamValue }));
  }

  function isFieldSynced(field: string): boolean {
    const config = fields.find(f => f.field === field);
    if (!config) return false;
    return !overrides[field] && config.upstream() !== undefined;
  }

  function getSyncSource(field: string): string | null {
    const config = fields.find(f => f.field === field);
    if (!config || overrides[field] || config.upstream() === undefined) return null;
    return config.source;
  }

  function isFieldOverridden(field: string): boolean {
    return !!overrides[field];
  }

  return {
    overrides,
    markOverride,
    resetField,
    isFieldSynced,
    getSyncSource,
    isFieldOverridden,
  };
}
