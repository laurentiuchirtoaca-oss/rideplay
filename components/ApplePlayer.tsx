"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Play, Radio } from "lucide-react";
import { Button } from "./ui";
import { loadMusicKit, mkTrack, type MusicKitInstance } from "@/lib/musickit";
import type { Command, SessionState } from "@/lib/types";

/**
 * Apple Music: this component turns the driver's RIDEPLAY page into the
 * player. It carries out passengers' commands with MusicKit and reports back
 * what is playing. Apple provides no way to control the native Music app.
 */
export default function ApplePlayer({
  state,
  src,
  onReported,
}: {
  state: SessionState;
  src: string | null;
  onReported: () => void;
}) {
  const sid = state.session.id;
  const [mk, setMk] = useState<MusicKitInstance | null>(null);
  const [phase, setPhase] = useState<"loading" | "needs_auth" | "needs_tap" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const done = useRef(new Set<number>());
  const running = useRef(false);

  // Load MusicKit.
  useEffect(() => {
    if (!src) {
      setPhase("error");
      setError("Apple Music isn't set up on this server.");
      return;
    }
    loadMusicKit(src)
      .then((m) => {
        setMk(m);
        setPhase(m.isAuthorized ? "needs_tap" : "needs_auth");
      })
      .catch((e) => {
        setPhase("error");
        setError((e as Error).message);
      });
  }, [src]);

  const report = useCallback(
    async (results: { id: number; ok: boolean; error?: string }[] = []) => {
      if (!mk) return;
      const item = mk.nowPlayingItem;
      const playback = {
        track: mkTrack(item),
        isPlaying: !!mk.isPlaying,
        progressMs: Math.round((mk.currentPlaybackTime || 0) * 1000),
      };
      try {
        const r = await fetch(`/api/session/${sid}/player`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playback, results }),
        });
        const data = await r.json().catch(() => ({}));
        if (data.skip) await mk.skipToNextItem().catch(() => {});
        if (results.length) onReported();
      } catch {
        /* next report retries */
      }
    },
    [mk, sid, onReported]
  );

  const execute = useCallback(
    async (c: Command) => {
      if (!mk) throw new Error("Player not ready");
      const p = c.payload as Record<string, string>;
      switch (c.kind) {
        case "enqueue": {
          const empty = !mk.nowPlayingItem && !(mk.queue?.items?.length > 0);
          if (empty) {
            await mk.setQueue({ song: p.id });
            await mk.play();
          } else await mk.playLater({ song: p.id });
          return;
        }
        case "play":
          await mk.play();
          return;
        case "pause":
          await mk.pause();
          return;
        case "next":
          await mk.skipToNextItem();
          return;
        case "previous":
          await mk.skipToPreviousItem();
          return;
        case "playContext":
          await mk.setQueue({ [p.type]: p.id });
          await mk.play();
          return;
        default:
          throw new Error("Unknown command");
      }
    },
    [mk]
  );

  // Carry out pending commands in order.
  useEffect(() => {
    if (phase !== "ready" || !mk || running.current) return;
    const todo = state.commands.filter((c) => !done.current.has(c.id));
    if (!todo.length) return;
    running.current = true;
    (async () => {
      const results: { id: number; ok: boolean; error?: string }[] = [];
      for (const c of todo) {
        done.current.add(c.id);
        try {
          await execute(c);
          results.push({ id: c.id, ok: true });
        } catch (e) {
          results.push({ id: c.id, ok: false, error: (e as Error)?.message || "Apple Music refused" });
        }
      }
      await new Promise((r) => setTimeout(r, 300));
      await report(results);
      running.current = false;
    })();
  }, [state.commands, phase, mk, execute, report]);

  // Report state on changes and every few seconds.
  useEffect(() => {
    if (phase !== "ready" || !mk) return;
    const onChange = () => report();
    mk.addEventListener("playbackStateDidChange", onChange);
    mk.addEventListener("nowPlayingItemDidChange", onChange);
    const t = setInterval(() => report(), 5000);
    report();
    return () => {
      mk.removeEventListener("playbackStateDidChange", onChange);
      mk.removeEventListener("nowPlayingItemDidChange", onChange);
      clearInterval(t);
    };
  }, [phase, mk, report]);

  if (phase === "ready")
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
        <Radio className="h-4 w-4 text-accent-ink" />
        <span className="flex-1">
          This phone is the Apple Music player. Keep RIDEPLAY open while you drive.
        </span>
      </div>
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center">
      {phase === "error" ? (
        <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
      ) : phase === "loading" ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted" />
      ) : (
        <Play className="h-5 w-5 shrink-0 text-accent-ink" />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {phase === "error" ? "The Apple Music player couldn't start" : phase === "loading" ? "Loading Apple Music…" : phase === "needs_auth" ? "Sign in to Apple Music again" : "Start the player"}
        </p>
        <p className="text-muted">
          {phase === "error"
            ? error
            : phase === "needs_tap"
              ? "Your browser needs one tap before RIDEPLAY can play sound."
              : "With Apple Music, this page plays the songs through your phone and car."}
        </p>
      </div>
      {phase === "needs_auth" && (
        <Button
          variant="primary"
          onClick={async () => {
            try {
              await mk!.authorize();
              setPhase("needs_tap");
            } catch {
              setError("Apple Music sign-in didn't finish.");
              setPhase("error");
            }
          }}
        >
          Sign in
        </Button>
      )}
      {phase === "needs_tap" && (
        <Button
          variant="primary"
          onClick={async () => {
            setPhase("ready");
            if (mk?.nowPlayingItem && !mk.isPlaying) await mk.play().catch(() => {});
          }}
        >
          Start player
        </Button>
      )}
    </div>
  );
}
