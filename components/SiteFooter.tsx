import Link from "next/link";
import Logo from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo className="text-lg" />
          <p className="mt-2 text-sm text-muted">Your ride. Your music. Everyone controls the vibe.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/start" className="hover:text-fg">Start a session</Link>
          <Link href="/join" className="hover:text-fg">Join a session</Link>
          <Link href="/privacy" className="hover:text-fg">Privacy</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
        Spotify and Apple Music are trademarks of their owners. RIDEPLAY is independent and never streams or stores music itself.
      </p>
    </footer>
  );
}
