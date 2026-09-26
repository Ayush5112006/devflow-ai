import { useState, useEffect, useCallback, useRef } from 'react';
import type { Investigation, ActivityEntry } from '../types/index.js';
import { api } from '../services/api.js';

export interface UseInvestigationResult {
  investigation: Investigation | null;
  activity: ActivityEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useInvestigation(id: string | undefined): UseInvestigationResult {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const { investigation: inv } = await api.getInvestigation(id);
      setInvestigation(inv);
      // The stored log is authoritative on load; live events append to it.
      if (inv.activity) setActivity(inv.activity);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    setLoading(true);
    api.getInvestigation(id)
      .then(({ investigation: inv }) => {
        setInvestigation(inv);
        if (inv.activity) setActivity(inv.activity);
        setLoading(false);
      })
      .catch((e) => { setError(e instanceof Error ? e.message : String(e)); setLoading(false); });

    const es = api.stream(id);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data) as { type: string; payload: unknown };
        if (event.type === 'snapshot') {
          setInvestigation(event.payload as Investigation);
        } else if (event.type === 'activity') {
          const entry = (event.payload as { entry: ActivityEntry }).entry;
          setActivity((prev) => [entry, ...prev].slice(0, 200));
        } else if (event.type !== undefined) {
          // Any other event: refresh investigation state.
          refresh();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // SSE errors are normal on connection close — don't show as app errors.
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [id, refresh]);

  return { investigation, activity, loading, error, refresh };
}
