import { cx } from "@/lib/cx";

/**
 * RIDEPLAY wordmark: "RIDE" light, "PLAY" heavy, joined by a play glyph that
 * doubles as the turn signal between the two words. Works on dark and light.
 */
export default function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-[0.18em] text-[22px] leading-none tracking-[-0.04em]", className)} aria-label="RIDEPLAY">
      {!compact && <span className="font-light" aria-hidden>RIDE</span>}
      <svg viewBox="0 0 20 22" className="h-[0.78em] w-[0.72em] shrink-0" aria-hidden>
        <path d="M2.5 2.6v16.8a1.6 1.6 0 0 0 2.4 1.37l13.4-8.4a1.6 1.6 0 0 0 0-2.74L4.9 1.23A1.6 1.6 0 0 0 2.5 2.6Z" fill="var(--accent)" />
      </svg>
      {!compact && <span className="font-bold" aria-hidden>PLAY</span>}
    </span>
  );
}
