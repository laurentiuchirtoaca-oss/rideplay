"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionState } from "./types";

export type Status = "loading" | "ready" | "ended" | "removed" | "not_member" | "not_found" | "error";
export type Connection = "live" | "polling" | "reconnecting";

/**
 * Keeps one session's state in sync:
 *  - instant pushes over Supabase Realtime when configured (a "something
 *    changed" ping; data itself always comes from the authenticated API),
 *  - regular refreshes for playback progress and as a fallback,
 *  - automatic recovery after the phone was offline or in the background.
 */
export function useSession(sessionId: string) {
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [endedReason, setEndedReason] = useState<string>("");
  const [connection, setConnection] = useState<Connection>("polling");
  const [realtimeUp, setRealtimeUp] = useState(false);

  const versionRef = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const failures = useRef(0);
  const statusRef = useRef<Status>("loading");
  statusRef.current = status;

  const fetchState = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    const run = (async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}/state`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        failures.current = 0;
        if (res.ok && data.ended) {
          setEndedReason(data.reason || "");
          setStatus("ended");
          return;
        }
        if (res.ok) {
          versionRef.current = data.session.version;
          setState({ ...(data as SessionState), receivedAt: Date.now() });
          setStatus("ready");
          setConnection((c) => (c === "reconnecting" ? "polling" : c));
          return;
        }
        if (res.status === 403 && data.code === "removed") setStatus("removed");
        else if (res.status === 401) setStatus("not_member");
        else if (res.status === 404) setStatus("not_found");
        else if (res.status >= 500 || res.status === 429) {
          failures.current++;
          if (statusRef.current === "loading") setStatus("error");
        }
      } catch {
        failures.current++;
        setConnection("reconnecting");
        if (statusRef.current === "loading") setStatus("error");
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    if (again.current) {
      again.current = false;
      await fetchState();
    }
  }, [sessionId]);

  // First load + polling loop (adapts to visibility and realtime).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const s = statusRef.current;
      if (s === "ended" || s === "removed" || s === "not_found") return;
      await fetchState();
      const hidden = typeof document !== "undefined" && document.hidden;
      const backoff = failures.current ? Math.min(15000, 2000 * 2 ** (failures.current - 1)) : 0;
      const base = hidden ? 30000 : realtimeUp ? 5000 : 3000;
      timer = setTimeout(tick, Math.max(base, backoff));
    };
    tick();
    const wake = () => {
      if (!document.hidden) fetchState();
    };
    const online = () => {
      setConnection("reconnecting");
      fetchState();
    };
    const offline = () => setConnection("reconnecting");
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [fetchState, realtimeUp]);

  // Realtime subscription.
  const rt = state?.realtime;
  const rtKey = rt ? `${rt.url}|${rt.channel}` : "";
  useEffect(() => {
    if (!rt) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(rt.url, rt.key, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = client
        .channel(rt.channel)
        .on("broadcast", { event: "sync" }, (msg) => {
          const v = Number((msg.payload as { v?: number })?.v || 0);
          if (!v || v > versionRef.current) fetchState();
        })
        .subscribe((s) => {
          if (s === "SUBSCRIBED") {
            setRealtimeUp(true);
            setConnection("live");
            fetchState();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            setRealtimeUp(false);
            setConnection((c) => (c === "live" ? "polling" : c));
          }
        });
      cleanup = () => {
        client.removeChannel(ch);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
      setRealtimeUp(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtKey, fetchState]);

  return { state, status, endedReason, connection, refresh: fetchState, setState };
}

/** Current progress, advancing smoothly between server updates (clock-skew safe). */
export function useProgress(state: SessionState | null) {
  const [now, setNow] = useState(() => Date.now());
  const pb = state?.playback;
  useEffect(() => {
    if (!pb?.isPlaying) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [pb?.isPlaying]);
  if (!state || !pb || !pb.track) return { progress: 0, duration: 0 };
  const duration = pb.track.durationMs || 0;
  // Translate "now" into server time using the moment the state arrived.
  const offset = (state.receivedAt || now) - Date.parse(state.serverTime);
  const measuredAt = pb.at ? Date.parse(pb.at) : Date.parse(state.serverTime);
  const elapsed = pb.isPlaying ? Math.max(0, now - offset - measuredAt) : 0;
  const progress = pb.progressMs + elapsed;
  return { progress: Math.max(0, duration ? Math.min(duration, progress) : progress), duration };
}
