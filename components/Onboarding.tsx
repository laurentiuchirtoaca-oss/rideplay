"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, Check, CircleAlert, Gauge, ListPlus, Loader2, Lock, Monitor, RefreshCw, Smartphone, Speaker, ListMusic,
} from "lucide-react";
import { Button, Card, cx } from "./ui";
import { useToast } from "./toast";
import { api, ApiFail, providerName } from "@/lib/client";
import { loadMusicKit } from "@/lib/musickit";
import type { ProviderId } from "@/lib/types";

type HostStatus = {
  configured: { database: boolean; spotify: boolean; apple: boolean };
  musicKitSrc: string | null;
  host: {
    provider: ProviderId;
    displayName: string;
    settings: Record<string, string>;
    session: { id: string; name: string; code: string } | null;
  } | null;
};

type Device = { id: string | null; name: string; type: string; active: boolean; restricted: boolean };
type Step = "provider" | "permissions" | "device" | "name";

const ERRORS: Record<string, string> = {
  denied: "You didn't allow access in Spotify, so RIDEPLAY can't control the music. Try again when you're ready.",
  state: "The sign-in took too long or was opened in another browser. Please try again.",
  connect: "Spotify sign-in didn't finish. If you're not on the app's user list yet, ask whoever set up RIDEPLAY to add your Spotify email.",
  spotify_not_configured: "Spotify isn't set up on this RIDEPLAY server yet.",
};

const PERMS: Record<ProviderId, { icon: typeof Gauge; title: string; text: string }[]> = {
  spotify: [
    { icon: Gauge, title: "See what's playing and where", text: "Song, progress and which device is playing." },
    { icon: ListPlus, title: "Control playback", text: "Play, pause, skip and add songs to your queue. Requires Spotify Premium." },
    { icon: ListMusic, title: "Read your playlists", text: "So passengers can pick from them. RIDEPLAY never changes them." },
  ],
  apple: [
    { icon: Speaker, title: "Play Apple Music in this page", text: "Apple doesn't let apps control the Music app remotely, so this RIDEPLAY page becomes the player on your phone." },
    { icon: ListPlus, title: "Manage the play queue", text: "Passengers' songs are added to the queue this page plays." },
  ],
};

export default function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState<ProviderId>("spotify");
  const [busy, setBusy] = useState(false);
  const error = params.get("error");

  const load = useCallback(async () => {
    const s = await api<HostStatus>("/api/host").catch(() => null);
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    load().then((s) => {
      if (params.get("step") === "device" && s?.host) {
        setProvider(s.host.provider);
        setStep(s.host.provider === "spotify" ? "device" : "name");
      }
    });
  }, [load, params]);

  const choose = (p: ProviderId) => {
    setProvider(p);
    setStep(status?.host?.provider === p ? (p === "spotify" ? "device" : "name") : "permissions");
  };

  const back = () => setStep(step === "name" ? (provider === "spotify" ? "device" : "provider") : "provider");

  if (!status)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );

  const live = status.host?.session;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 sm:px-6">
      <Progress step={step} provider={provider} />

      {error && step === "provider" && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0 text-danger" />
          <p>{ERRORS[error] || "Something went wrong. Please try again."}</p>
        </div>
      )}

      {live && step === "provider" && (
        <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">“{live.name}” is running</p>
            <p className="text-sm text-muted">Starting a new session ends that one for everyone.</p>
          </div>
          <Button variant="primary" onClick={() => router.push("/drive")}>Open dashboard</Button>
        </Card>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
        >
          {step !== "provider" && (
            <button onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}

          {step === "provider" && (
            <>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Where&apos;s your music?</h1>
              <p className="mt-2 text-muted">Pick the service on the phone that&apos;s connected to the car. Passengers browse that service&apos;s catalogue.</p>
              {!status.configured.database && (
                <p className="mt-5 rounded-2xl bg-warn/10 p-4 text-sm text-warn">
                  This server isn&apos;t set up yet (database settings missing). See the README, or open /api/health.
                </p>
              )}
              <div className="mt-6 grid gap-3">
                <ProviderCard
                  name="Spotify"
                  color="#1ED760"
                  text="Controls the Spotify app on the driver's phone. Needs Spotify Premium."
                  state={
                    !status.configured.spotify ? "unavailable" : status.host?.provider === "spotify" ? "connected" : "ready"
                  }
                  account={status.host?.provider === "spotify" ? status.host.displayName : undefined}
                  onChoose={() => choose("spotify")}
                />
                <ProviderCard
                  name="Apple Music"
                  color="#FA2D48"
                  text="Plays inside RIDEPLAY on the driver's phone. Needs an Apple Music subscription."
                  state={!status.configured.apple ? "unavailable" : status.host?.provider === "apple" ? "connected" : "ready"}
                  account={status.host?.provider === "apple" ? status.host.displayName : undefined}
                  onChoose={() => choose("apple")}
                  unavailableNote="Not set up on this server. It needs an Apple Developer account — see the README."
                />
              </div>
            </>
          )}

          {step === "permissions" && (
            <PermissionsStep
              provider={provider}
              musicKitSrc={status.musicKitSrc}
              busy={busy}
              onSpotify={() => {
                setBusy(true);
                window.location.href = "/api/spotify/login";
              }}
              onApple={async (name) => {
                setBusy(true);
                try {
                  const mk = await loadMusicKit(status.musicKitSrc || "");
                  await mk.authorize();
                  await api("/api/apple/connect", {
                    method: "POST",
                    json: { storefront: mk.storefrontCountryCode || mk.storefrontId || "us", name },
                  });
                  await load();
                  setStep("name");
                } catch (e) {
                  toast({ tone: "error", text: e instanceof ApiFail ? e.message : (e as Error).message || "Apple Music sign-in didn't finish." });
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {step === "device" && <DeviceStep onDone={() => setStep("name")} />}

          {step === "name" && (
            <NameStep
              defaultName={status.host ? `${status.host.displayName.split(" ")[0]}'s ride` : "Road trip"}
              provider={provider}
              hasLive={!!live}
              onCreate={async (name) => {
                try {
                  await api("/api/host/session", { method: "POST", json: { name } });
                  router.push("/drive");
                } catch (e) {
                  toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't create the session." });
                }
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Progress({ step, provider }: { step: Step; provider: ProviderId }) {
  const steps: Step[] = provider === "spotify" ? ["provider", "permissions", "device", "name"] : ["provider", "permissions", "name"];
  const idx = steps.indexOf(step);
  return (
    <div className="mb-8 flex gap-1.5" aria-label={`Step ${idx + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <span key={s} className={cx("h-1 flex-1 rounded-full transition-colors", i <= idx ? "bg-accent" : "bg-line")} />
      ))}
    </div>
  );
}

function ProviderCard({
  name, color, text, state, account, onChoose, unavailableNote,
}: {
  name: string;
  color: string;
  text: string;
  state: "ready" | "connected" | "unavailable";
  account?: string;
  onChoose: () => void;
  unavailableNote?: string;
}) {
  const off = state === "unavailable";
  return (
    <button
      onClick={onChoose}
      disabled={off}
      className={cx(
        "group flex w-full items-center gap-4 rounded-[20px] border bg-card p-5 text-left transition",
        off ? "border-line opacity-60" : "border-line hover:border-fg/30 active:scale-[0.99]"
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}1f` }}>
        <span className="h-5 w-5 rounded-full" style={{ background: color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-lg font-semibold">{name}</span>
          {state === "connected" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent-ink">
              <Check className="h-3 w-3" /> Connected
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {off ? unavailableNote || "Not set up on this server." : state === "connected" ? `Signed in as ${account}` : text}
        </span>
      </span>
    </button>
  );
}

function PermissionsStep({
  provider, busy, onSpotify, onApple, musicKitSrc,
}: {
  provider: ProviderId;
  busy: boolean;
  onSpotify: () => void;
  onApple: (name: string) => void;
  musicKitSrc: string | null;
}) {
  const [name, setName] = useState("");
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Connect {providerName(provider)}</h1>
      <p className="mt-2 text-muted">RIDEPLAY asks only for what it needs to run the car&apos;s music:</p>
      <ul className="mt-6 space-y-3">
        {PERMS[provider].map((p) => (
          <li key={p.title} className="flex gap-4 rounded-[20px] border border-line bg-card p-4">
            <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="mt-0.5 text-sm text-muted">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-2 text-sm text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        {provider === "spotify"
          ? "Your Spotify sign-in stays on the RIDEPLAY server, encrypted. Passengers never see it. Disconnect any time in Settings."
          : "Your Apple Music sign-in stays in this browser. The server only stores your country, for search."}
      </p>
      {provider === "apple" && (
        <label className="mt-6 block">
          <span className="text-sm font-medium">Your name, shown to passengers</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Ana"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-card px-4 text-[16px] outline-none focus:border-accent/60"
          />
        </label>
      )}
      <Button
        variant="primary"
        size="lg"
        className="mt-6 w-full"
        loading={busy}
        disabled={provider === "apple" && !musicKitSrc}
        onClick={() => (provider === "spotify" ? onSpotify() : onApple(name.trim() || "Driver"))}
      >
        Continue to {providerName(provider)}
      </Button>
    </>
  );
}

function DeviceStep({ onDone }: { onDone: () => void }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ devices: Device[]; selected: string | null }>("/api/host/devices");
      setDevices(r.devices);
      const pick = r.selected || r.devices.find((d) => d.active)?.id || r.devices.find((d) => d.type === "Smartphone")?.id || "";
      setSelected((s) => s || pick || "");
    } catch (e) {
      setError(e instanceof ApiFail ? e.message : "Couldn't load your devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirm = async () => {
    setSaving(true);
    try {
      const d = devices?.find((x) => x.id === selected);
      await api("/api/host/devices", { method: "POST", json: { deviceId: selected, deviceName: d?.name || "" } });
      onDone();
    } catch (e) {
      toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't save the device." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Which phone plays the music?</h1>
      <p className="mt-2 text-muted">
        Pick your phone — the one connected to the car. Spotify must be open on it to appear here.
      </p>
      <div className="mt-6 space-y-2">
        {devices === null && !error ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : error ? (
          <p className="rounded-2xl bg-danger/10 p-4 text-sm text-danger">{error}</p>
        ) : (
          <>
            {devices!.map((d) => (
              <button
                key={d.id || d.name}
                disabled={!d.id || d.restricted}
                onClick={() => d.id && setSelected(d.id)}
                className={cx(
                  "flex w-full items-center gap-4 rounded-[18px] border p-4 text-left transition disabled:opacity-50",
                  selected === d.id ? "border-accent bg-accent/[0.06]" : "border-line bg-card hover:border-fg/30"
                )}
              >
                {d.type === "Smartphone" ? <Smartphone className="h-5 w-5 text-muted" /> : d.type === "Computer" ? <Monitor className="h-5 w-5 text-muted" /> : <Speaker className="h-5 w-5 text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{d.name}</span>
                  <span className="block text-sm text-muted">
                    {d.restricted ? "Spotify doesn't allow remote control of this device" : d.active ? "Playing now" : d.type}
                  </span>
                </span>
                <span className={cx("flex h-5 w-5 items-center justify-center rounded-full border-2", selected === d.id ? "border-accent bg-accent text-on-accent" : "border-line")}>
                  {selected === d.id && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </button>
            ))}
            <button
              onClick={() => setSelected("")}
              className={cx(
                "flex w-full items-center gap-4 rounded-[18px] border p-4 text-left transition",
                selected === "" ? "border-accent bg-accent/[0.06]" : "border-line bg-card hover:border-fg/30"
              )}
            >
              <Speaker className="h-5 w-5 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Whichever device is playing</span>
                <span className="block text-sm text-muted">Follow Spotify&apos;s active device</span>
              </span>
              <span className={cx("flex h-5 w-5 items-center justify-center rounded-full border-2", selected === "" ? "border-accent bg-accent text-on-accent" : "border-line")}>
                {selected === "" && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
            {devices!.length === 0 && (
              <p className="rounded-2xl bg-card-2 p-4 text-sm text-muted">
                No devices found. Open Spotify on your phone, play any song for a second, then tap Refresh.
              </p>
            )}
          </>
        )}
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" size="lg" onClick={refresh} loading={loading} aria-label="Refresh devices">
          {!loading && <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
        <Button variant="primary" size="lg" className="flex-1" loading={saving} onClick={confirm} disabled={devices === null && !error}>
          Use this device
        </Button>
      </div>
    </>
  );
}

function NameStep({
  defaultName, onCreate, hasLive, provider,
}: {
  defaultName: string;
  onCreate: (name: string) => Promise<void>;
  hasLive: boolean;
  provider: ProviderId;
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onCreate(name);
        setBusy(false);
      }}
    >
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Name your ride</h1>
      <p className="mt-2 text-muted">Passengers see this when they join.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoFocus
        aria-label="Session name"
        className="mt-6 h-14 w-full rounded-2xl border border-line bg-card px-5 text-lg outline-none focus:border-accent/60"
      />
      {provider === "apple" && (
        <p className="mt-4 rounded-2xl bg-card-2 p-4 text-sm text-muted">
          Keep RIDEPLAY open on this phone during the ride — with Apple Music, this page is the player.
        </p>
      )}
      {hasLive && <p className="mt-4 text-sm text-warn">This ends your current session for everyone in it.</p>}
      <Button variant="primary" size="lg" className="mt-6 w-full" loading={busy} type="submit">
        Create session
      </Button>
      <p className="mt-4 text-center text-sm text-muted">
        Sessions end automatically after 12 hours. <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
      </p>
    </form>
  );
}
