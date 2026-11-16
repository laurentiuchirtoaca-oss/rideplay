"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Power, QrCode, Settings, Users } from "lucide-react";
import Logo from "./Logo";
import NowPlaying from "./NowPlaying";
import QueueList from "./QueueList";
import MusicSearch from "./MusicSearch";
import ApplePlayer from "./ApplePlayer";
import { Avatar, Passengers, SharePanel } from "./DriverPanels";
import { LiveStatus, ProviderTag } from "./music";
import { Button, Card, Empty, Segmented, SectionTitle, Sheet } from "./ui";
import { useToast } from "./toast";
import { api, ApiFail, useMediaQuery } from "@/lib/client";
import { useActions } from "@/lib/useActions";
import { useSession } from "@/lib/useSession";
import type { ProviderId } from "@/lib/types";

type Host = {
  host: { provider: ProviderId; displayName: string; session: { id: string; name: string } | null } | null;
  musicKitSrc: string | null;
};

export default function DriverApp() {
  const router = useRouter();
  const [host, setHost] = useState<Host | null>(null);

  useEffect(() => {
    api<Host>("/api/host")
      .then((h) => {
        if (!h.host) router.replace("/start");
        else setHost(h);
      })
      .catch(() => setHost({ host: null, musicKitSrc: null }));
  }, [router]);

  if (!host)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );

  if (!host.host?.session)
    return (
      <Shell>
        <Empty
          icon={<QrCode className="h-6 w-6" />}
          title="No session running"
          action={
            <Link href="/start" className="inline-flex h-12 items-center rounded-xl bg-accent px-6 font-semibold text-on-accent">
              Start a session
            </Link>
          }
        >
          Create a session to get a QR code for your passengers.
        </Empty>
      </Shell>
    );

  return <Dashboard sessionId={host.host.session.id} musicKitSrc={host.musicKitSrc} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="RIDEPLAY home">
          <Logo />
        </Link>
        <Link href="/drive/settings" aria-label="Settings" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-card-2 hover:text-fg">
          <Settings className="h-5 w-5" />
        </Link>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6">{children}</main>
    </div>
  );
}

type Tab = "queue" | "add" | "share" | "people";

function Dashboard({ sessionId, musicKitSrc }: { sessionId: string; musicKitSrc: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const { state, status, connection, refresh } = useSession(sessionId);
  const actions = useActions(state, refresh);
  const [tab, setTab] = useState<Tab>("queue");
  const [shareOpen, setShareOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");

  const end = useCallback(async () => {
    if (!confirm("End the session for everyone? Passengers will be disconnected and the link stops working.")) return;
    setEnding(true);
    try {
      await api("/api/host/session", { method: "DELETE", json: { sessionId } });
      toast({ tone: "info", text: "Session ended" });
      router.push("/start");
    } catch (e) {
      toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't end the session." });
      setEnding(false);
    }
  }, [sessionId, router, toast]);

  if (status === "loading" || (!state && status === "ready"))
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );

  if (status === "ended" || status === "not_found" || status === "not_member" || !state)
    return (
      <Shell>
        <Empty
          icon={<Power className="h-6 w-6" />}
          title={status === "error" ? "Can't reach RIDEPLAY" : "This session has ended"}
          action={
            status === "error" ? (
              <Button onClick={() => refresh()}>Try again</Button>
            ) : (
              <Link href="/start" className="inline-flex h-12 items-center rounded-xl bg-accent px-6 font-semibold text-on-accent">
                Start a new session
              </Link>
            )
          }
        >
          {status === "error" ? "Check your connection." : "Start a new one whenever you're ready."}
        </Empty>
      </Shell>
    );

  const online = state.participants.filter((p) => p.online).length;
  const waiting = state.queue.filter((q) => q.status === "queued").length;

  return (
    <div className="min-h-dvh pb-[max(24px,env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="RIDEPLAY home" className="shrink-0">
            <span className="hidden sm:inline-flex"><Logo /></span>
            <span className="inline-flex sm:hidden"><Logo compact /></span>
          </Link>
          <div className="ml-1 min-w-0 flex-1 sm:ml-4">
            <p className="truncate text-sm font-semibold leading-tight">{state.session.name}</p>
            <div className="flex items-center gap-3">
              <LiveStatus connection={connection} />
              <span className="hidden sm:inline-flex"><ProviderTag provider={state.session.provider} /></span>
            </div>
          </div>
          <button
            onClick={() => (desktop ? document.getElementById("people")?.scrollIntoView({ behavior: "smooth" }) : setTab("people"))}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-card-2 px-3.5 text-sm font-medium hover:bg-line"
            aria-label={`${state.participants.length} passengers connected`}
          >
            <Users className="h-4 w-4" />
            <span className="tabular">{state.participants.length}</span>
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent lg:hidden"
          >
            <QrCode className="h-4 w-4" /> Share
          </button>
          <span className="hidden sm:block">
            <Avatar name={state.session.hostName} size={34} />
          </span>
          <Link href="/drive/settings" aria-label="Settings" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-card-2 hover:text-fg">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:pt-8">
        <div className="min-w-0 space-y-6">
          {state.session.provider === "apple" && <ApplePlayer state={state} src={musicKitSrc} onReported={refresh} />}
          <NowPlaying state={state} onControl={actions.control} />

          {/* Mobile tabs */}
          <div className="lg:hidden">
            <Segmented
              label="Dashboard sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: "queue", label: waiting ? `Queue (${waiting})` : "Queue" },
                { value: "add", label: "Add music" },
                { value: "people", label: `Passengers` },
              ]}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className={tab === "queue" ? "p-4 sm:p-5" : "hidden p-4 sm:p-5 lg:block"}>
              <SectionTitle>Shared queue</SectionTitle>
              <QueueList
                state={state}
                onRemove={actions.remove}
                onRetry={actions.retry}
                emptyAction={<Button size="sm" variant="outline" className="lg:hidden" onClick={() => setTab("add")}>Add a song</Button>}
              />
            </Card>
            <Card className={tab === "add" ? "p-4 sm:p-5" : "hidden p-4 sm:p-5 lg:block"}>
              <SectionTitle>Add music</SectionTitle>
              <MusicSearch state={state} onAdd={actions.add} onPlayContext={actions.playContext} />
            </Card>
          </div>
          {!desktop && tab === "people" && (
            <Card className="p-4 sm:p-5">
              <SectionTitle>Passengers</SectionTitle>
              <Passengers state={state} onChanged={refresh} />
            </Card>
          )}
        </div>

        {/* Desktop side column */}
        {desktop && <aside className="space-y-6">
          <Card className="p-5">
            <SectionTitle action={<span className="text-xs text-muted">{online} in the app now</span>}>Invite passengers</SectionTitle>
            <SharePanel state={state} onRegenerated={refresh} />
          </Card>
          <Card className="p-5" id="people">
            <SectionTitle>Passengers</SectionTitle>
            <Passengers state={state} onChanged={refresh} />
          </Card>
          <Button variant="danger" className="w-full" onClick={end} loading={ending}>
            <Power className="h-4 w-4" /> End session
          </Button>
        </aside>}

        {!desktop && (
          <div>
            <Button variant="danger" className="w-full" onClick={end} loading={ending}>
              <Power className="h-4 w-4" /> End session
            </Button>
          </div>
        )}
      </main>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Invite passengers">
        <SharePanel state={state} onRegenerated={refresh} />
      </Sheet>
    </div>
  );
}

