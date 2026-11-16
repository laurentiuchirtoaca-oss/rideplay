"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Pause, Plus, Search, SkipForward } from "lucide-react";
import { cx } from "./ui";

/* An illustration of the concept with invented songs — tap "Add" to try it. */

type Song = { id: string; title: string; artist: string; art: string };

const ART = (a: string, b: string, c: string) =>
  `radial-gradient(120% 90% at 20% 15%, ${a} 0%, transparent 55%), radial-gradient(90% 80% at 85% 90%, ${b} 0%, transparent 60%), ${c}`;

const CATALOG: Song[] = [
  { id: "a", title: "Tangerine Static", artist: "Mira Vale", art: ART("#FFB36B", "#E1497A", "#2A1631") },
  { id: "b", title: "Overpass", artist: "The Quiet Hours", art: ART("#7FD6FF", "#3B4CCA", "#0F1530") },
  { id: "c", title: "Long Way Home", artist: "Northbound", art: ART("#C9F27A", "#2E8F6B", "#0E2019") },
];

const NOW: Song = { id: "n", title: "Night Drive Signals", artist: "Lumen Coast", art: ART("#B8F36B", "#2B5B4A", "#10161A") };
const START_QUEUE: (Song & { by: string })[] = [
  { id: "q1", title: "Salt Air", artist: "Harbor Lights", art: ART("#F2C14E", "#B04A2F", "#20140F"), by: "Ana" },
];

export default function HeroDemo() {
  const [queue, setQueue] = useState(START_QUEUE);
  const [added, setAdded] = useState<string[]>([]);
  const [ping, setPing] = useState<string | null>(null);

  const add = (s: Song) => {
    if (added.includes(s.id)) return;
    setAdded((a) => [...a, s.id]);
    setQueue((q) => [...q, { ...s, id: "q-" + s.id, by: "You" }]);
    setPing(s.title);
    setTimeout(() => setPing(null), 1600);
  };

  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-label="Interactive illustration of RIDEPLAY">
      {/* Driver's phone */}
      <div className="relative z-0 ml-auto w-[74%] rounded-[34px] border border-line bg-bg-2 p-2.5 shadow-soft">
        <div className="min-h-[400px] rounded-[26px] bg-bg p-4 sm:min-h-[440px]">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Driver&apos;s phone</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" /> 3 passengers
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-3 p-3">
              <div className="h-14 w-14 shrink-0 rounded-xl" style={{ background: NOW.art }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{NOW.title}</p>
                <p className="truncate text-xs text-muted">{NOW.artist}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-on-accent">
                <Pause className="h-4 w-4" fill="currentColor" />
              </span>
              <SkipForward className="h-4 w-4 text-muted" fill="currentColor" />
            </div>
            <div className="h-[3px] bg-line/60">
              <motion.div className="h-full bg-accent" initial={{ width: "18%" }} animate={{ width: "64%" }} transition={{ duration: 30, ease: "linear" }} />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted">Up next</p>
          <ol className="mt-2 space-y-1.5">
            <AnimatePresence initial={false}>
              {queue.map((s, i) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -24, backgroundColor: "rgba(184,243,107,0.18)" }}
                  animate={{ opacity: 1, x: 0, backgroundColor: "rgba(184,243,107,0)" }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-2.5 rounded-xl p-1.5"
                >
                  <span className="w-3 text-center text-[11px] text-muted">{i + 1}</span>
                  <div className="h-8 w-8 shrink-0 rounded-md" style={{ background: s.art }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{s.title}</p>
                    <p className="truncate text-[11px] text-muted">Added by {s.by}</p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </div>

      {/* Passenger's phone */}
      <div className="absolute -bottom-16 left-0 z-10 w-[50%] rounded-[30px] border border-line bg-bg-2 p-2 shadow-soft sm:-bottom-20">
        <div className="rounded-[24px] bg-bg p-3">
          <p className="text-[11px] text-muted">Passenger</p>
          <div className="mt-2 flex h-9 items-center gap-2 rounded-xl border border-line bg-card px-3 text-xs text-muted">
            <Search className="h-3.5 w-3.5" /> Search songs
          </div>
          <ul className="mt-2 space-y-1">
            {CATALOG.map((s) => {
              const done = added.includes(s.id);
              return (
                <li key={s.id} className="flex items-center gap-2 rounded-xl p-1">
                  <div className="h-8 w-8 shrink-0 rounded-md" style={{ background: s.art }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{s.title}</p>
                    <p className="truncate text-[10px] text-muted">{s.artist}</p>
                  </div>
                  <button
                    onClick={() => add(s)}
                    aria-label={done ? `${s.title} added` : `Add ${s.title} (demo)`}
                    className={cx(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90",
                      done ? "bg-accent/15 text-accent-ink" : "bg-accent text-on-accent hover:brightness-105"
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <AnimatePresence>
        {ping && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-3 top-3 z-20 rounded-full border border-line bg-card px-3 py-1.5 text-xs shadow-soft"
          >
            Sent to the driver&apos;s queue
          </motion.div>
        )}
      </AnimatePresence>
      <p className="sr-only">Tap Add on the passenger phone to see a song appear in the driver&apos;s queue. Songs shown are invented examples.</p>
    </div>
  );
}
