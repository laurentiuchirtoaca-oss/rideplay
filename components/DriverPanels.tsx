"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, RefreshCw, Share2, ShieldCheck, UserMinus, Users } from "lucide-react";
import { Button, Empty, Switch, cx } from "./ui";
import { useToast } from "./toast";
import { api, ApiFail } from "@/lib/client";
import type { Participant, Permissions, SessionState } from "@/lib/types";

/* ---------------------------------------------------------------- QR ---- */

export function SharePanel({ state, onRegenerated }: { state: SessionState; onRegenerated: () => void }) {
  const url = state.session.joinUrl || "";
  const code = state.session.code || "";
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [regen, setRegen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0B0C0F", light: "#FFFFFF" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ tone: "error", text: "Couldn't copy. Long-press the link to copy it." });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my RIDEPLAY session", text: `Control the music in ${state.session.name}`, url });
      } catch {
        /* user cancelled */
      }
    } else copy();
  };

  const regenerate = async () => {
    if (!confirm("Create a new link? The current QR code and link will stop working. People already in the car stay connected.")) return;
    setRegen(true);
    try {
      await api("/api/host/session", { method: "PATCH", json: { sessionId: state.session.id, regenerate: true } });
      toast({ tone: "success", text: "New link ready. The old one no longer works." });
      onRegenerated();
    } catch (e) {
      toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't create a new link." });
    } finally {
      setRegen(false);
    }
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div
          key={url}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-[20px] bg-white p-3"
        >
          {svg ? (
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="skeleton h-full w-full rounded-xl" />
          )}
        </motion.div>
      </AnimatePresence>
      <p className="mt-4 text-center text-sm text-muted">Passengers scan this with their camera. No app or account needed.</p>
      <p className="mt-3 text-center text-[13px] text-muted">
        Or enter code <span className="font-semibold tracking-[0.12em] text-fg">{code}</span> at <span className="text-fg">{url.replace(/^https?:\/\//, "").split("/")[0]}/join</span>
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg-2 p-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm text-muted" title={url}>
          {url.replace(/^https?:\/\//, "")}
        </span>
        <Button size="sm" variant="secondary" onClick={copy} aria-label="Copy link">
          {copied ? <Check className="h-4 w-4 text-accent-ink" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={share}>
          <Share2 className="h-4 w-4" /> Share link
        </Button>
        <Button variant="outline" onClick={regenerate} loading={regen}>
          {!regen && <RefreshCw className="h-4 w-4" />} New link
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- passengers ---- */

export function Passengers({ state, onChanged }: { state: SessionState; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const list = state.participants;

  const update = async (p: Participant, patch: { canControl?: boolean; remove?: boolean }) => {
    if (patch.remove && !confirm(`Remove ${p.name} from the session? They'll need the link again to rejoin.`)) return;
    setBusy(p.id);
    try {
      await api("/api/host/participants", { method: "POST", json: { sessionId: state.session.id, participantId: p.id, ...patch } });
      if (patch.remove) toast({ tone: "info", text: `${p.name} was removed.` });
      onChanged();
    } catch (e) {
      toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't update." });
    } finally {
      setBusy(null);
    }
  };

  if (!list.length)
    return (
      <Empty icon={<Users className="h-6 w-6" />} title="No passengers yet">
        Share the QR code. People who join appear here.
      </Empty>
    );

  return (
    <ul className="divide-y divide-line">
      {list.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3">
          <Avatar name={p.name} online={p.online} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{p.name}</p>
            <p className="text-xs text-muted">{p.online ? "In the app now" : "Away"}</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted" title="Allow play, pause and skip">
            <span className="hidden sm:inline">Controls</span>
            <button
              role="switch"
              aria-checked={p.canControl}
              aria-label={`Allow ${p.name} to control playback`}
              disabled={busy === p.id}
              onClick={() => update(p, { canControl: !p.canControl })}
              className={cx("relative inline-flex h-6 w-10 items-center rounded-full transition", p.canControl ? "bg-accent" : "bg-line")}
            >
              <span className={cx("inline-block h-4 w-4 rounded-full transition-transform", p.canControl ? "translate-x-5 bg-on-accent" : "translate-x-1 bg-fg")} />
            </button>
          </label>
          <button
            onClick={() => update(p, { remove: true })}
            disabled={busy === p.id}
            aria-label={`Remove ${p.name}`}
            title="Remove from session"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-danger/12 hover:text-danger"
          >
            <UserMinus className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, online, size = 36 }: { name: string; online?: boolean; size?: number }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="inline-flex items-center justify-center rounded-full font-semibold text-[#0B0C0F]"
        style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 55% 72%)` }}
        aria-hidden
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
      {online !== undefined && (
        <span className={cx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", online ? "bg-accent" : "bg-line")} />
      )}
    </span>
  );
}

/* ------------------------------------------------------ permissions ---- */

export function PermissionsForm({ state, onChanged }: { state: SessionState; onChanged: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<Permissions>(state.session.permissions);
  useEffect(() => setP(state.session.permissions), [state.session.permissions]);

  const save = async (patch: Partial<Permissions>) => {
    const prev = p;
    setP({ ...p, ...patch });
    try {
      await api("/api/host/session", { method: "PATCH", json: { sessionId: state.session.id, permissions: patch } });
      onChanged();
    } catch (e) {
      setP(prev);
      toast({ tone: "error", text: e instanceof ApiFail ? e.message : "Couldn't save." });
    }
  };

  return (
    <div className="divide-y divide-line">
      <Switch checked={p.allowAdd} onChange={(v) => save({ allowAdd: v })} label="Passengers can add songs" description="Songs go into the shared queue and to your music app." />
      <Switch checked={p.allowPlayback} onChange={(v) => save({ allowPlayback: v })} label="Passengers can play and pause" />
      <Switch checked={p.allowSkip} onChange={(v) => save({ allowSkip: v })} label="Passengers can skip songs" description="Next and previous." />
      <div className="flex items-center justify-between gap-4 py-3">
        <span>
          <span className="block text-[15px] font-medium">Songs waiting per passenger</span>
          <span className="mt-0.5 block text-[13px] text-muted">Stops one person from filling the queue.</span>
        </span>
        <div className="flex items-center gap-1 rounded-full bg-card-2 p-1">
          <button aria-label="Fewer" className="h-8 w-8 rounded-full text-lg hover:bg-line disabled:opacity-30" disabled={p.maxPerPerson <= 0} onClick={() => save({ maxPerPerson: Math.max(0, p.maxPerPerson - 1) })}>
            −
          </button>
          <span className="w-16 text-center text-sm font-medium tabular">{p.maxPerPerson === 0 ? "No limit" : p.maxPerPerson}</span>
          <button aria-label="More" className="h-8 w-8 rounded-full text-lg hover:bg-line disabled:opacity-30" disabled={p.maxPerPerson >= 20} onClick={() => save({ maxPerPerson: Math.min(20, p.maxPerPerson + 1) })}>
            +
          </button>
        </div>
      </div>
      <p className="flex items-start gap-2 pt-3 text-[13px] text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> You can also turn controls off for one person under Passengers.
      </p>
    </div>
  );
}
