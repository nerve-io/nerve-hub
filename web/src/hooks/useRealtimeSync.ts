import { useEffect, useRef, useCallback } from 'react';

interface WsEvent {
  type: string;
  projectId?: string;
  taskId?: string;
}

/**
 * useRealtimeSync — WebSocket hook for real-time data push.
 *
 * @param projectId  Filter: only trigger onUpdate when event.projectId matches.
 *                   Pass null to listen to all project events (e.g. ProjectList).
 * @param onUpdate   Callback invoked when a matching event is received.
 *
 * Behaviour:
 * - Connects to ws://localhost:3141/ws (or wss:// in production).
 * - In DEV mode, if the backend is not running, silently degrades (no console errors).
 * - On disconnect: auto-reconnect after 3s, up to 5 retries, then stop (polling fallback).
 * - On unmount: closes connection and stops retries.
 */
export function useRealtimeSync(projectId: string | null, onUpdate: () => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const mountedRef = useRef(true);

  onUpdateRef.current = onUpdate;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.DEV ? 'localhost:3141' : window.location.host;
    const url = `${protocol}//${host}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      // Connection failed (e.g. backend not running in dev mode) — silent degrade
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      retriesRef.current = 0;
    };

    ws.onmessage = (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const event: WsEvent = JSON.parse(e.data);
        // Filter by projectId if specified
        if (projectId !== null && event.projectId && event.projectId !== projectId) {
          return;
        }
        onUpdateRef.current();
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!mountedRef.current) return;
      if (retriesRef.current < 5) {
        retriesRef.current++;
        timerRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, handling reconnect there
    };
  }, [projectId]);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;
    connect();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect attempt
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
