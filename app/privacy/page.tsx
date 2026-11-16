import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS = [
  {
    h: "What RIDEPLAY stores",
    p: [
      "For the driver: the music service account name, the chosen playback device and — for Spotify — the sign-in tokens RIDEPLAY needs to control playback. Tokens are encrypted on the server and never sent to passengers' phones.",
      "For each session: its name, the display names passengers choose (optional), and the songs added to the queue.",
      "Passengers don't create accounts. A random, private cookie on their phone identifies them within one session only.",
    ],
  },
  {
    h: "What RIDEPLAY doesn't do",
    p: [
      "It never plays, downloads, stores or redistributes music. Songs play only through the driver's own Spotify or Apple Music subscription.",
      "It never asks for location, contacts, messages or your email, and it doesn't touch navigation.",
      "It doesn't sell or share data, and it has no ads or trackers.",
    ],
  },
  {
    h: "How long data is kept",
    p: [
      "Sessions end when the driver ends them, or automatically after 12 hours. Session names, passenger names and queues are deleted 7 days after a session ends.",
      "The driver's music sign-in is kept until they choose Disconnect in Settings, which deletes it immediately.",
    ],
  },
  {
    h: "Who can see what",
    p: [
      "Only people with the session's private link or code can join. The driver can make a new link at any time, which stops the old one from working, and can remove any passenger.",
      "Everyone in a session sees the queue, who added each song, and who is in the car.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-8 pt-8 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-[-0.035em]">Privacy</h1>
        <p className="mt-3 text-lg text-muted">RIDEPLAY keeps as little as it can, for as short a time as it can.</p>
        {SECTIONS.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight">{s.h}</h2>
            {s.p.map((t) => (
              <p key={t} className="mt-3 leading-relaxed text-muted">
                {t}
              </p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
