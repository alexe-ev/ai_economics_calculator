"use client";

import { useState, useEffect, useRef } from "react";

export function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(defaultValue);
  const initialized = useRef(false);

  // Load from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setState(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    initialized.current = true;
  }, [key]);

  // Save to localStorage on changes (skip initial mount)
  useEffect(() => {
    if (!initialized.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // localStorage full or unavailable
    }
  }, [key, state]);

  return [state, setState];
}
