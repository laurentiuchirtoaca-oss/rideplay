"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Loader2, LogOut, Power, Smartphone } from "lucide-react";
import ThemePicker from "./ThemePicker";
import { PermissionsForm } from "./DriverPanels";
import { ProviderTag } from "./music";
import { Button, Card } from "./ui";
import { useToast } from "./toast";
import { api, ApiFail, providerName } from "@/lib/client";
import { useSession } from "@/lib/useSession";
import type { ProviderId } from "@/lib/types";

type Host = {
  host: {
    provider: ProviderId;
    displayName: string;
    settings: Record<string, string>;
    session: { id: string; name: string } | null;
  } | null;
};

export default function DriverSettings() {
  const router = useRouter();
  const toast = useToast();
  const [host, setHost] = useState<Host["host"] | undefined>(undefined);

  useEffect(() => {
    api<Host>("/api/host")
      .then((h) => setHost(h.host))
      .catch(() => setHost(null));
  }, []);

  const disconnect = async () => {
    if (!confirm(`Disconnect ${host ? providerName(host.provider) : "your music"}? This deletes your stored sign-in from RIDEPLAY and ends your session.`)) return;
    try {
      await api("/api/host", { method: "DELETE" });
      toast({ tone: "info", text: "Disconnected. Your sign-in was deleted from RIDEPLAY." });
      router.push("/");
    } catch (e) {
      toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't disconnect." });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <Link href="/drive" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="text-4xl font-semibold tracking-[-0.035em]">Settings</h1>

      <Group title="Appearance">
        <ThemePicker />
      </Group>

      {host === undefined ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : (
        <>
          {host?.session && <SessionSettings sessionId={host.session.id} />}

          <Group title="Music service">
            {host ? (
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <ProviderTag provider={host.provider} />
                    <p className="mt-1 text-lg font-semibold">Signed in as {host.displayName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <Smartphone className="h-4 w-4" />
                      {host.provider === "spotify"
                        ? host.settings?.deviceName
                          ? `Plays on ${host.settings.deviceName}`
                          : "Plays on whichever device is active in Spotify"
                        : "Plays inside RIDEPLAY on this phone"}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {host.provider === "spotify" && (
                    <Link href="/start?step=device" className="inline-flex h-10 items-center rounded-xl bg-card-2 px-4 text-sm font-medium hover:bg-line">
                      Change playback device
                    </Link>
                  )}
                  <Button size="md" variant="danger" onClick={disconnect}>
                    <LogOut className="h-4 w-4" /> Disconnect and delete sign-in
                  </Button>
                </div>
                {host.provider === "spotify" && (
                  <p className="mt-4 text-[13px] leading-relaxed text-muted">
                    Spotify allows remote control only with Premium. Songs sent to Spotify can&apos;t be taken back out of its queue — if you remove one, RIDEPLAY skips it when it starts.
                  </p>
                )}
                {host.provider === "apple" && (
                  <p className="mt-4 text-[13px] leading-relaxed text-muted">
                    Apple doesn&apos;t let other apps control the Music app, so RIDEPLAY plays Apple Music itself. Keep this page open; if your phone locks for a long time, the browser may pause it.
                  </p>
                )}
              </Card>
            ) : (
              <Card className="p-5">
                <p className="text-muted">No music service connected.</p>
                <Link href="/start" className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-semibold text-on-accent">
                  Connect music
                </Link>
              </Card>
            )}
          </Group>

          <Group title="Privacy">
            <Card className="p-5 text-sm leading-relaxed text-muted">
              Passengers&apos; names and the songs they add are kept only for the session and deleted 7 days after it ends.
              Your Spotify sign-in is stored encrypted until you disconnect.{" "}
              <Link href="/privacy" className="text-fg underline underline-offset-2">
                Read the privacy notice
              </Link>
            </Card>
          </Group>
        </>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function SessionSettings({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { state, refresh } = useSession(sessionId);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (state) setName((n) => n || state.session.name);
  }, [state]);

  if (!state) return null;

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/host/session", { method: "PATCH", json: { sessionId, name } });
      toast({ tone: "success", text: "Name saved" });
      refresh();
    } catch (err) {
      toast({ tone: "error", text: err instanceof ApiFail ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  };

  const extend = async () => {
    await api("/api/host/session", { method: "PATCH", json: { sessionId, extend: true } })
      .then(() => {
        toast({ tone: "success", text: "Session extended by 12 hours" });
        refresh();
      })
      .catch((e) => toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't extend." }));
  };

  const end = async () => {
    if (!confirm("End the session for everyone?")) return;
    await api("/api/host/session", { method: "DELETE", json: { sessionId } })
      .then(() => router.push("/start"))
      .catch((e) => toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't end it." }));
  };

  const ends = new Date(state.session.expiresAt);

  return (
    <>
      <Group title="Session">
        <Card className="p-5">
          <form onSubmit={rename} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              aria-label="Session name"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg-2 px-4 text-[16px] outline-none focus:border-accent/60"
            />
            <Button type="submit" loading={saving} disabled={!name.trim() || name === state.session.name}>
              Save
            </Button>
          </form>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Clock className="h-4 w-4" /> Ends automatically at {ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            <button onClick={extend} className="ml-1 font-medium text-fg underline underline-offset-2">
              Extend
            </button>
          </p>
        </Card>
      </Group>
      <Group title="Session permissions">
        <Card className="px-5 py-2">
          <PermissionsForm state={state} onChanged={refresh} />
        </Card>
      </Group>
      <div className="mt-6">
        <Button variant="danger" className="w-full" onClick={end}>
          <Power className="h-4 w-4" /> End session
        </Button>
      </div>
    </>
  );
}
