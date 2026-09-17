"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Polls an async fetcher on an interval. Returns {data, error, loading, refresh}.
 * Keeps polling through errors so a backend restart self-heals the UI.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs = 4000,
): { data: T | null; error: string | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const tick = useCallback(async () => {
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [tick, intervalMs]);

  return { data, error, loading, refresh: tick };
}
