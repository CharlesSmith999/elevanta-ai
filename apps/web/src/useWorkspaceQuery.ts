import { useEffect, useRef, useState } from 'react';
import { cachedQuery, invalidateQueries, queryValue, subscribeQuery } from './queryCache';

export function useWorkspaceQuery<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, ttl = 60_000) {
  const loadRef = useRef(load); loadRef.current = load;
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; loading: boolean }>({key, data: key ? queryValue<T>(key) : undefined, loading: Boolean(key)});
  useEffect(() => {
    if (!key) { setState({key, loading: false}); return; }
    let active = true; let generation = 0;
    const refresh = () => {
      const current = ++generation;
      setState({key, data: queryValue<T>(key), loading: true});
      void cachedQuery(key, signal => loadRef.current(signal), ttl).then(data => {
        if (active && current === generation) setState({key, data, loading: false});
      }).catch(error => {
        if (active && current === generation) setState({key, data: queryValue<T>(key), error: error instanceof Error ? error.message : 'Could not load this page.', loading: false});
      });
    };
    refresh();
    const unsubscribe = subscribeQuery(key, refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onVisible);
    return () => { active = false; generation++; unsubscribe(); window.removeEventListener('focus', onVisible); };
  }, [key, ttl]);
  const current = state.key === key ? state : {key, data: key ? queryValue<T>(key) : undefined, loading: Boolean(key), error: undefined};
  return {...current, refresh: () => { if (key) invalidateQueries(candidate => candidate === key); }};
}

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setSettled(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return settled;
}
