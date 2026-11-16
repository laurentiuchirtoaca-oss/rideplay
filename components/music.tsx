"use client";

import { AnimatePresence, motion } from "motion/react";
import { Music2 } from "lucide-react";
import { cx } from "./ui";
import type { ProviderId } from "@/lib/types";

/* Square album artwork with a calm fallback. */
export function Artwork({
  src,
  size = 48,
  className,
  rounded = "rounded-lg",
  alt = "",
}: {
  src?: string | null;
  size?: number;
  className?: string;
  rounded?: string;
  alt?: string;
}) {
  return (
    <span
      className={cx("relative inline-flex shrink-0 overflow-hidden bg-card-2", rounded, className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted">
          <Music2 style={{ width: size * 0.38, height: size * 0.38 }} />
        </span>
      )}
    </span>
  );
}

/* Artwork that cross-fades when the song changes. */
export function ArtworkTransition({ src, trackKey, className }: { src?: string | null; trackKey: string; className?: string }) {
  return (
    <div className={cx("relative aspect-square overflow-hidden bg-card-2", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={trackKey}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <Music2 className="h-1/4 w-1/4" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* Provider label. Text only — official logos come from each brand's kit. */
export function ProviderTag({ provider, className }: { provider: ProviderId; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs font-medium text-muted", className)}>
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: provider === "spotify" ? "#1ED760" : "#FA2D48" }}
      />
      {provider === "spotify" ? "Spotify" : "Apple Music"}
    </span>
  );
}

export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cx("eq inline-flex h-4 items-end gap-[3px]", !playing && "paused", className)} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

/* Connection dot + label. */
export function LiveStatus({ connection }: { connection: "live" | "polling" | "reconnecting" }) {
  if (connection === "reconnecting")
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-warn">
        <span className="h-2 w-2 animate-pulse rounded-full bg-warn" />
        Reconnecting…
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted" title={connection === "live" ? "Instant updates" : "Updates every few seconds"}>
      <span className="live-dot h-2 w-2 rounded-full bg-accent" />
      Connected
    </span>
  );
}
