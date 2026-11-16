"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Clock3, ListMusic, Loader2, RotateCw, Trash2 } from "lucide-react";
import { Artwork, Equalizer, ProviderTag } from "./music";
import { Empty, cx } from "./ui";
import { formatMs } from "@/lib/client";
import type { QueueItem, SessionState } from "@/lib/types";

export default function QueueList({
  state,
  onRemove,
  onRetry,
  emptyAction,
}: {
  state: SessionState;
  onRemove?: (item: QueueItem) => void;
  onRetry?: (item: QueueItem) => void;
  emptyAction?: React.ReactNode;
}) {
  const items = state.queue;
  const playing = items.find((i) => i.status === "playing");
  const upcoming = items.filter((i) => i.status === "queued");

  if (!items.length)
    return (
      <Empty icon={<ListMusic className="h-6 w-6" />} title="The queue is empty" action={emptyAction}>
        Songs anyone adds show up here, in the order they'll play.
      </Empty>
    );

  return (
    <div>
      {playing && (
        <div className="mb-2 flex items-center gap-3 rounded-2xl bg-accent/[0.07] p-2.5 pr-3">
          <Artwork src={playing.artwork} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-accent-ink">{playing.title}</p>
            <p className="truncate text-sm text-muted">
              {playing.artist} <span className="text-muted/70">— added by {playing.addedByName}</span>
            </p>
          </div>
          <Equalizer playing={state.playback.isPlaying} />
        </div>
      )}
      <ol className="space-y-1" aria-label="Up next">
        <AnimatePresence initial={false}>
          {upcoming.map((it, idx) => (
            <motion.li
              key={it.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className="group flex items-center gap-3 rounded-2xl p-2.5 pr-2 hover:bg-card-2/60"
            >
              <span className="w-5 shrink-0 text-center text-sm font-medium text-muted tabular">{idx + 1}</span>
              <Artwork src={it.artwork} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.title}</p>
                <p className="truncate text-sm text-muted">{it.artist}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>
                    Added by <span className={cx("font-medium", it.addedBy && it.addedBy === state.me.id ? "text-accent-ink" : "text-fg/80")}>{it.addedBy && it.addedBy === state.me.id ? "you" : it.addedByName}</span>
                  </span>
                  <span className="hidden sm:inline-flex"><ProviderTag provider={it.provider} /></span>
                  <DispatchState item={it} />
                </div>
              </div>
              <span className="hidden text-xs text-muted tabular sm:block">{formatMs(it.durationMs)}</span>
              {it.dispatch === "failed" && onRetry && (state.role === "host" || it.addedBy === state.me.id) && (
                <button
                  onClick={() => onRetry(it)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-card-2 px-3 text-xs font-medium hover:bg-line"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Retry
                </button>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(it)}
                  aria-label={`Remove ${it.title}`}
                  title="Remove from queue"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-danger/12 hover:text-danger sm:opacity-60 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {!upcoming.length && playing && <p className="px-3 py-4 text-sm text-muted">Nothing else queued. Add the next song.</p>}
    </div>
  );
}

function DispatchState({ item }: { item: QueueItem }) {
  if (item.dispatch === "sent") return null;
  if (item.dispatch === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-warn">
        {item.provider === "apple" ? <Clock3 className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
        {item.provider === "apple" ? "Waiting for the driver's player" : "Sending…"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-danger" title={item.error || undefined}>
      <AlertCircle className="h-3 w-3" /> Not sent{item.error ? `: ${item.error}` : ""}
    </span>
  );
}
