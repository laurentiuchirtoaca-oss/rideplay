import Link from "next/link";
import { Car, Link2, ListMusic, Music2, Navigation, Smartphone } from "lucide-react";
import HeroDemo from "@/components/HeroDemo";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const STEPS = [
  {
    icon: Music2,
    title: "Connect your music",
    text: "The driver signs in with Spotify on their phone and picks it as the player. That phone stays connected to the car as usual.",
  },
  {
    icon: Link2,
    title: "Share your session",
    text: "RIDEPLAY shows a private QR code. Passengers scan it with their camera and they're in — no app, no account.",
  },
  {
    icon: ListMusic,
    title: "Let passengers control the queue",
    text: "Everyone searches the catalogue and adds songs to one shared queue. You decide who may skip or pause.",
  },
];

export default function Landing() {
  return (
    <>
      <SiteHeader
        right={
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/join" className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:text-fg">
              Join a session
            </Link>
            <Link href="/start" className="hidden h-10 items-center rounded-xl bg-card-2 px-4 text-sm font-medium hover:bg-line sm:inline-flex">
              Start a session
            </Link>
          </nav>
        }
      />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-16">
          <div>
            <h1 className="text-[clamp(44px,8.4vw,92px)] font-semibold leading-[0.95] tracking-[-0.045em]">
              Your car.
              <br />
              Your music.
              <br />
              <span className="text-muted">Your rules.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Let everyone control the music, without touching your phone.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/start"
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-accent px-7 text-base font-semibold text-on-accent shadow-[0_10px_30px_-12px_var(--accent)] transition hover:brightness-105 active:scale-[0.98]"
              >
                Start a session
              </Link>
              <Link
                href="/join"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-line px-7 text-base font-semibold transition hover:bg-card-2 active:scale-[0.98]"
              >
                Join a session
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted">Free to use. The driver needs Spotify Premium.</p>
          </div>
          <div className="pb-20">
            <HeroDemo />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="how">
          <h2 id="how" className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-[24px] border border-line bg-card p-6">
                <div className="flex items-center justify-between">
                  <s.icon className="h-6 w-6 text-accent-ink" />
                  <span className="text-sm font-medium text-muted tabular">Step {i + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-24 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2" aria-labelledby="driver">
          <div>
            <h2 id="driver" className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              The driver&apos;s phone stays in charge
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted">
              Passengers&apos; phones are remote controls. They never play audio, and nobody needs to pick up the driver&apos;s phone.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              { icon: Car, t: "Music keeps playing through the car", d: "Bluetooth, CarPlay or cable — whatever the driver already uses." },
              { icon: Navigation, t: "Navigation is never interrupted", d: "RIDEPLAY only sends commands to the music app. Maps stay on screen." },
              { icon: Smartphone, t: "Private and temporary", d: "Each session has its own link. Make a new one any time; sessions end on their own after 12 hours." },
            ].map((x) => (
              <li key={x.t} className="flex gap-4 rounded-[20px] border border-line p-5">
                <x.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
                <div>
                  <p className="font-medium">{x.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{x.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
