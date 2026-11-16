"use client";

import { useState } from "react";
import { ExternalLink, Pause, Play, SkipBack, SkipForward, Smartphone, TriangleAlert } from "lucide-react";
import { ArtworkTransition, Equalizer, ProviderTag } from "./music";
import { cx } from "./ui";
import { formatMs, providerName } from "@/lib/client";
import { useProgress } from "@/lib/useSession";
import type { SessionState } from "@/lib/types";

export type ControlAction = "play" | "pause" | "next" | "previous";

const PROBLEMS: Record<string, { title: string; driver: string; passenger: string }> = {
  no_device: {
    title: "Spotify isn't playing on the driver's phone",
    driver: "Open Spotify on your phone and start any song. RIDEPLAY picks it up within a few seconds.",
    passenger: "Ask the driver to open Spotify and start a song. You can still search and add to the queue.",
  },
  premium_required: {
    title: "Spotify Premium needed",
    driver: "Spotify only allows remote control with a Premium account.",
    passenger: "The driver's Spotify account needs Premium for remote control.",
  },
  auth: {
    title: "Music connection expired",
    driver: "Reconnect your music account in Settings.",
    passenger: "The driver needs to reconnect their music account.",
  },
  player_offline: {
    title: "The driver's player isn't open",
    driver: "Keep this RIDEPLAY page open — it is the Apple Music player.",
    passenger: "Ask the driver to open RIDEPLAY on their phone. Songs you add will wait until then.",
  },
  rate_limited: {
    title: "The music service is busy",
    driver: "Playback info will refresh in a few seconds.",
    passenger: "Playback info will refresh in a few seconds.",
  },
  unavailable: {
    title: "The music service didn't respond",
    driver: "Retrying automatically.",
    passenger: "Retrying automatically.",
  },
};

export default function NowPlaying({
  state,
  onControl,
  variant = "hero",
}: {
  state: SessionState;
  onControl: (a: ControlAction) => Promise<void>;
  variant?: "hero" | "compact";
}) {
  const [busy, setBusy] = useState<ControlAction | null>(null);
  const { playback: pb, caps, role, session } = state;
  const { progress, duration } = useProgress(state);
  const track = pb.track;
  const problem = pb.error ? PROBLEMS[pb.error] : null;
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;

  const run = async (a: ControlAction) => {
    if (busy) return;
    setBusy(a);
    try {
      await onControl(a);
    } finally {
      setBusy(null);
    }
  };

  const controls = (size: "lg" | "md") => {
    const big = size === "lg";
    const btn = cx("inline-flex items-center justify-center rounded-full transition active:scale-95 disabled:opacity-30", big ? "h-12 w-12" : "h-10 w-10");
    return (
      <div className="flex items-center gap-2">
        <button
          className={cx(btn, "text-fg hover:bg-card-2")}
          aria-label="Previous"
          title={caps.skip ? "Previous" : "The driver turned off skipping for you"}
          disabled={!caps.skip || !!busy}
          onClick={() => run("previous")}
        >
          <SkipBack className={big ? "h-6 w-6" : "h-5 w-5"} fill="currentColor" />
        </button>
        <button
          className={cx(
            "inline-flex items-center justify-center rounded-full bg-accent text-on-accent transition hover:brightness-105 active:scale-95 disabled:opacity-30",
            big ? "h-16 w-16" : "h-12 w-12",
            busy === "play" || busy === "pause" ? "animate-pulse" : ""
          )}
          aria-label={pb.isPlaying ? "Pause" : "Play"}
          title={caps.playback ? (pb.isPlaying ? "Pause" : "Play") : "The driver turned off playback control for you"}
          disabled={!caps.playback || !!busy}
          onClick={() => run(pb.isPlaying ? "pause" : "play")}
        >
          {pb.isPlaying ? (
            <Pause className={big ? "h-7 w-7" : "h-5 w-5"} fill="currentColor" />
          ) : (
            <Play className={cx(big ? "h-7 w-7" : "h-5 w-5", "translate-x-[2px]")} fill="currentColor" />
          )}
        </button>
        <button
          className={cx(btn, "text-fg hover:bg-card-2")}
          aria-label="Next"
          title={caps.skip ? "Next" : "The driver turned off skipping for you"}
          disabled={!caps.skip || !!busy}
          onClick={() => run("next")}
        >
          <SkipForward className={big ? "h-6 w-6" : "h-5 w-5"} fill="currentColor" />
        </button>
      </div>
    );
  };

  const noControls = !caps.playback && !caps.skip;

  if (variant === "compact") {
    return (
      <div className="relative overflow-hidden rounded-[20px] border border-line bg-card">
        <div className="flex items-center gap-3 p-3">
          <ArtworkTransition src={track?.artwork} trackKey={track?.trackId || "none"} className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            {track ? (
              <>
                <p className="truncate font-semibold leading-tight">{track.title}</p>
                <p className="truncate text-sm text-muted">{track.artist}</p>
              </>
            ) : (
              <>
                <p className="truncate font-semibold leading-tight">{problem?.title || "Nothing playing yet"}</p>
                <p className="truncate text-sm text-muted">{problem ? problem.passenger : "Add a song to get things going."}</p>
              </>
            )}
          </div>
          {!noControls && track && controls("md")}
        </div>
        <div className="h-[3px] bg-line/60">
          <div className="h-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Now playing" className="relative overflow-hidden rounded-[24px] border border-line bg-card shadow-soft">
      {/* blurred artwork glow */}
      {track?.artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.artwork} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-[0.18] blur-3xl" />
      )}
      <div className="relative grid gap-5 p-5 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center sm:gap-7 sm:p-6">
        <ArtworkTransition src={track?.artwork} trackKey={track?.trackId || "none"} className="mx-auto w-full max-w-[200px] rounded-2xl shadow-soft min-[420px]:max-w-[240px] sm:max-w-none" />
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ProviderTag provider={session.provider} />
            {track && (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                <Equalizer playing={pb.isPlaying} />
                {pb.isPlaying ? "Playing" : "Paused"}
              </span>
            )}
          </div>

          {track ? (
            <>
              <h2 className="text-balance text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">{track.title}</h2>
              <p className="mt-1 truncate text-base text-muted">
                {track.artist}
                {track.album ? <span className="hidden sm:inline"> — {track.album}</span> : null}
              </p>
            </>
          ) : problem ? (
            <div className="flex gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 className="text-xl font-semibold leading-tight">{problem.title}</h2>
                <p className="mt-1 text-sm text-muted">{role === "host" ? problem.driver : problem.passenger}</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Nothing playing yet</h2>
              <p className="mt-1 text-sm text-muted">
                {role === "host" ? `Start a song in ${providerName(session.provider)}, or add one below.` : "Search for a song and add it to the queue."}
              </p>
            </>
          )}

          {track && (
            <div className="mt-5 flex items-center gap-3 text-xs text-muted tabular">
              <span className="w-9">{formatMs(progress)}</span>
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Song progress">
                <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-9 text-right">{formatMs(duration)}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {noControls ? (
              <p className="text-sm text-muted">The driver controls playback in this session.</p>
            ) : (
              controls("lg")
            )}
            <div className="flex items-center gap-3 text-xs text-muted">
              {pb.device?.name && (
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  {pb.device.name}
                </span>
              )}
              {track?.url && (
                <a href={track.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg">
                  Open in {providerName(session.provider)} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* signature: the progress line runs along the bottom edge of the display */}
      <div className="relative h-[3px] bg-transparent">
        <div className="h-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
