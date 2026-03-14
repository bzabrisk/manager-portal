import { useState, useEffect, useCallback, useRef } from 'react';

export function usePolling(fetchFn, intervalMs = 2 * 60 * 1000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchRef.current();
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('Polling error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [refresh, intervalMs]);

  return { data, loading, error, refresh };
}
