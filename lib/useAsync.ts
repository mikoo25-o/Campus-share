"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyError } from "./errors";

/**
 * Small data-loading hook: runs `fn` on mount and whenever `deps` change, ignores stale results,
 * and exposes loading, a friendly error message, and a reload function.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const runId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (id === runId.current) setData(result);
    } catch (e) {
      if (id === runId.current) setError(friendlyError(e, "We couldn't load this. Please try again."));
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, loading, reload, setData };
}

/** Throws when a Supabase response carries an error, so useAsync can show it. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
