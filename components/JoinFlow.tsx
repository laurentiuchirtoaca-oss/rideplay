"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Users } from "lucide-react";
import { Artwork, Equalizer, ProviderTag } from "./music";
import { Button, Empty } from "./ui";
import { api, ApiFail } from "@/lib/client";
import type { ProviderId, Track } from "@/lib/types";

/* ------------------------------------------------- enter a code (/join) -- */

export function CodeEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const code = extractCode(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length >= 6) router.push(`/j/${code}`);
      }}
      className="w-full"
    >
      <label htmlFor="code" className="text-sm font-medium">
        Session code or link
      </label>
      <input
        id="code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="e.g. 7KQ2MXRP"
        className="mt-2 h-16 w-full rounded-2xl border border-line bg-card px-5 text-center text-2xl font-semibold uppercase tracking-[0.18em] outline-none placeholder:text-base placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:border-accent/60"
      />
      <Button variant="primary" size="lg" className="mt-4 w-full" type="submit" disabled={code.length < 6}>
        Continue
      </Button>
      <p className="mt-4 text-center text-sm text-muted">The code is under the QR code on the driver&apos;s screen.</p>
    </form>
  );
}

function extractCode(v: string) {
  const m = v.match(/\/j\/([A-Za-z0-9]+)/);
  return (m ? m[1] : v).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/* ---------------------------------------------- join screen (/j/CODE) -- */

type Preview = {
  id: string;
  name: string;
  provider: ProviderId;
  hostName: string;
  nowPlaying: Track | null;
  isPlaying: boolean;
  passengers: number;
};

export function JoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const p = await api<Preview>(`/api/preview?code=${encodeURIComponent(code)}`);
        // Already in this session on this phone (or it's the driver)? Go straight in.
        const s = await fetch(`/api/session/${p.id}/state?probe=1`, { cache: "no-store" });
        if (s.ok) {
          const st = await s.json();
          if (st.role) return router.replace(st.role === "host" ? "/drive" : `/s/${p.id}`);
        }
        try {
          setName(localStorage.getItem("rp-name") || "");
        } catch {}
        if (!off) setPreview(p);
      } catch (e) {
        if (!off) setError({ code: e instanceof ApiFail ? e.code : "error", message: e instanceof ApiFail ? e.message : "Couldn't load the session." });
      }
    })();
    return () => {
      off = true;
    };
  }, [code, router]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    try {
      try {
        localStorage.setItem("rp-name", name.trim());
      } catch {}
      const r = await api<{ sessionId: string }>("/api/join", { method: "POST", json: { code, name: name.trim() } });
      router.replace(`/s/${r.sessionId}`);
    } catch (e) {
      setError({ code: e instanceof ApiFail ? e.code : "error", message: e instanceof ApiFail ? e.message : "Couldn't join." });
      setJoining(false);
    }
  };

  if (error)
    return (
      <Empty
        icon={<LogIn className="h-6 w-6" />}
        title={error.code === "ended" ? "This session has ended" : error.code === "network" ? "No connection" : "Session not found"}
        action={
          <Button variant="outline" onClick={() => router.push("/join")}>
            Enter a code
          </Button>
        }
      >
        {error.message}
      </Empty>
    );

  if (!preview)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );

  const t = preview.nowPlaying;

  return (
    <form onSubmit={join} className="w-full">
      <p className="text-muted">You&apos;re joining a RIDEPLAY session.</p>
      <h1 className="mt-2 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em]">{preview.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>Hosted by {preview.hostName}</span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {preview.passengers} {preview.passengers === 1 ? "passenger" : "passengers"}
        </span>
        <ProviderTag provider={preview.provider} />
      </div>

      <div className="mt-6 flex items-center gap-4 rounded-[20px] border border-line bg-card p-3">
        <Artwork src={t?.artwork} size={64} rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{t ? (preview.isPlaying ? "Playing now" : "Paused") : "Nothing playing yet"}</p>
          {t ? (
            <>
              <p className="truncate font-semibold">{t.title}</p>
              <p className="truncate text-sm text-muted">{t.artist}</p>
            </>
          ) : (
            <p className="text-sm text-muted">You can start the queue.</p>
          )}
        </div>
        {t && <Equalizer playing={preview.isPlaying} className="mr-2" />}
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium">Your name</span>
        <span className="text-sm text-muted"> (optional, shown next to songs you add)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoComplete="given-name"
          placeholder="e.g. Mihai"
          className="mt-2 h-14 w-full rounded-2xl border border-line bg-card px-5 text-[16px] outline-none focus:border-accent/60"
        />
      </label>
      <Button variant="primary" size="lg" className="mt-5 w-full" type="submit" loading={joining}>
        Join session
      </Button>
      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        No account needed. Your phone becomes a remote — the music plays from the driver&apos;s phone.
      </p>
    </form>
  );
}
