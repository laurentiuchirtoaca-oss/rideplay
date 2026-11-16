"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { History, Home, ListMusic, Loader2, LogOut, Menu, Search, UserX, WifiOff, Power } from "lucide-react";
import Logo from "./Logo";
import NowPlaying from "./NowPlaying";
import QueueList from "./QueueList";
import MusicSearch from "./MusicSearch";
import ThemePicker from "./ThemePicker";
import { Avatar } from "./DriverPanels";
import { Artwork, LiveStatus, ProviderTag } from "./music";
import { Button, Card, Empty, IconButton, SectionTitle, Sheet, cx } from "./ui";
import { api, useMediaQuery } from "@/lib/client";
import { useActions } from "@/lib/useActions";
import { useSession } from "@/lib/useSession";

type Tab = "home" | "search" | "queue";

export default function PassengerApp({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { state, status, connection, refresh } = useSession(sessionId);
  const actions = useActions(state, refresh);
  const [tab, setTab] = useState<Tab>("home");
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");

  const leave = async () => {
    setLeaving(true);
    await api(`/api/session/${sessionId}/leave`, { method: "POST" }).catch(() => {});
    router.replace("/");
  };

  if (status === "loading")
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );

  if (status !== "ready" || !state) {
    const msg =
      status === "ended"
        ? { icon: <Power className="h-6 w-6" />, title: "The driver ended the session", text: "Thanks for riding along. Ask the driver for a new link next time." }
        : status === "removed"
          ? { icon: <UserX className="h-6 w-6" />, title: "You were removed from this session", text: "The driver removed you. Ask them if you'd like to rejoin." }
          : status === "error"
            ? { icon: <WifiOff className="h-6 w-6" />, title: "Can't reach RIDEPLAY", text: "Check your internet connection. RIDEPLAY reconnects automatically." }
            : { icon: <LogOut className="h-6 w-6" />, title: "You're not in this session", text: "Open the driver's link or scan their QR code to join." };
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4">
          <Link href="/" aria-label="RIDEPLAY home">
            <Logo />
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          <Empty
            icon={msg.icon}
            title={msg.title}
            action={
              status === "error" ? (
                <Button onClick={() => refresh()}>Try again</Button>
              ) : (
                <Link href="/join" className="inline-flex h-11 items-center rounded-xl bg-card-2 px-5 font-medium hover:bg-line">
                  Join another session
                </Link>
              )
            }
          >
            {msg.text}
          </Empty>
        </main>
      </div>
    );
  }

  const upcoming = state.queue.filter((q) => q.status === "queued").length;

  const homeView = (
    <div className="space-y-6">
      <NowPlaying state={state} onControl={actions.control} />
      <button
        onClick={() => setTab("search")}
        className="flex h-14 w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 text-left text-muted transition hover:border-fg/30 lg:hidden"
      >
        <Search className="h-5 w-5" /> Search for a song to add
      </button>
      <Card className="p-4 sm:p-5">
        <SectionTitle action={state.recent.length > 0 ? <button className="text-sm text-muted hover:text-fg" onClick={() => setTab("queue")}>See queue</button> : undefined}>
          Recently added
        </SectionTitle>
        {state.recent.length ? (
          <ul className="space-y-1">
            {state.recent.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl p-1.5">
                <Artwork src={r.artwork} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted">
                    {r.artist} — {r.addedBy === state.me.id ? "you" : r.addedByName}
                  </p>
                </div>
                <span className="text-xs text-muted">{r.status === "playing" ? "Playing" : r.status === "played" ? "Played" : "Up next"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<History className="h-6 w-6" />} title="No songs added yet">
            Be the first — search and tap Add.
          </Empty>
        )}
      </Card>
      <Card className="p-4 sm:p-5">
        <SectionTitle>In the car</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-card-2 py-1 pl-1 pr-3 text-sm">
            <Avatar name={state.session.hostName} size={28} /> {state.session.hostName} <span className="text-muted">(driver)</span>
          </span>
          {state.participants.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-card-2 py-1 pl-1 pr-3 text-sm">
              <Avatar name={p.name} size={28} /> {p.me ? `${p.name} (you)` : p.name}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );

  const queueView = (
    <Card className="p-4 sm:p-5">
      <SectionTitle action={<span className="text-sm text-muted">{upcoming} up next</span>}>Shared queue</SectionTitle>
      <QueueList state={state} onRetry={actions.retry} emptyAction={<Button size="sm" variant="primary" onClick={() => setTab("search")}>Add a song</Button>} />
    </Card>
  );

  const searchView = <MusicSearch state={state} onAdd={actions.add} onPlayContext={actions.playContext} autoFocus={tab === "search"} />;

  return (
    <div className="min-h-dvh pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="RIDEPLAY home" className="shrink-0">
            <span className="inline-flex sm:hidden"><Logo compact /></span>
            <span className="hidden sm:inline-flex"><Logo /></span>
          </Link>
          <div className="ml-1 min-w-0 flex-1 sm:ml-4">
            <p className="truncate text-sm font-semibold leading-tight">{state.session.name}</p>
            <div className="flex items-center gap-3">
              <LiveStatus connection={connection} />
              <span className="hidden sm:inline-flex"><ProviderTag provider={state.session.provider} /></span>
            </div>
          </div>
          <IconButton label="Menu" onClick={() => setMenu(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
        </div>
        <AnimatePresence>
          {connection === "reconnecting" && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-warn/12 text-center text-sm text-warn">
              <p className="py-1.5">Connection lost — reconnecting…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile: one tab at a time */}
      {!desktop && <main className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {tab === "home" ? homeView : tab === "search" ? searchView : queueView}
          </motion.div>
        </AnimatePresence>
      </main>}

      {/* Desktop: search beside the player and queue */}
      {desktop && <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 px-6 pt-8">
        <div>
          <h1 className="mb-4 text-2xl font-semibold tracking-[-0.02em]">Find music</h1>
          {searchView}
        </div>
        <div className="space-y-6">
          <NowPlaying state={state} onControl={actions.control} variant="compact" />
          {queueView}
        </div>
      </main>}

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Sections">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {(
            [
              { k: "home", label: "Now", icon: Home },
              { k: "search", label: "Search", icon: Search },
              { k: "queue", label: upcoming ? `Queue (${upcoming})` : "Queue", icon: ListMusic },
            ] as const
          ).map((x) => (
            <button
              key={x.k}
              onClick={() => setTab(x.k)}
              aria-current={tab === x.k ? "page" : undefined}
              className={cx("flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition", tab === x.k ? "text-fg" : "text-muted")}
            >
              <x.icon className={cx("h-5 w-5", tab === x.k && "text-accent-ink")} />
              {x.label}
            </button>
          ))}
        </div>
      </nav>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Settings">
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">You</p>
            <div className="flex items-center gap-3 rounded-2xl bg-card-2 p-3">
              <Avatar name={state.me.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{state.me.name}</p>
                <p className="text-xs text-muted">
                  {state.caps.playback || state.caps.skip ? "You can control playback" : "The driver controls playback"}
                  {state.caps.add ? "" : ". Adding songs is paused"}
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Theme</p>
            <ThemePicker />
          </div>
          <div className="space-y-2">
            <Link href="/privacy" className="block rounded-xl px-1 py-2 text-sm text-muted hover:text-fg">
              Privacy
            </Link>
            <Button variant="danger" className="w-full" onClick={leave} loading={leaving}>
              <LogOut className="h-4 w-4" /> Leave session
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
