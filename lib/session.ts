import "server-only";
import { AppError, notify, rpc } from "./db";
import { env } from "./env";
import { decrypt, getHostToken, getPassengerToken, hashToken, requestOrigin } from "./security";
import { ProviderError, SpotifyClient, type SpotifySecrets } from "./providers/spotify";
import { AppleCatalog } from "./providers/apple";
import type { Playback, Permissions, ProviderId, QueueItem, SessionState } from "./types";

export type Actor = { kind: "host" | "participant"; id: string | null; name: string; canControl: boolean };

export type Ctx = {
  actor: Actor;
  session: {
    id: string;
    name: string;
    provider: ProviderId;
    code: string;
    channel: string;
    permissions: Permissions;
    playback: Playback & { at?: string };
    version: number;
    createdAt: string;
    expiresAt: string;
    playerSeen: string | null;
  };
  host: { id: string; displayName: string; secrets: string | null; settings: Record<string, string> };
};

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Resolves the caller (driver or passenger) for a session from their cookies. */
export async function loadContext(sessionId: string): Promise<Ctx> {
  if (!isUuid(sessionId)) throw new AppError("not_found", "This session doesn't exist.", 404);
  const hostToken = await getHostToken();
  const pToken = await getPassengerToken(sessionId);
  const r = await rpc<Ctx & { error?: string; reason?: string }>("rp_context", {
    p_session: sessionId,
    p_host_hash: hostToken ? hashToken(hostToken) : null,
    p_participant_hash: pToken ? hashToken(pToken) : null,
  });
  if (r.error === "ended") throw new AppError("ended", r.reason || "ended", 410);
  if (r.error === "removed") throw new AppError("removed", "The driver removed you from this session.", 403);
  if (r.error === "not_member") throw new AppError("not_member", "Join the session first.", 401);
  if (r.error) throw new AppError("not_found", "This session doesn't exist.", 404);
  return r;
}

export function requireHost(ctx: Ctx) {
  if (ctx.actor.kind !== "host") throw new AppError("forbidden", "Only the driver can do that.", 403);
}

export function caps(ctx: Ctx) {
  if (ctx.actor.kind === "host") return { add: true, playback: true, skip: true };
  const p = ctx.session.permissions;
  return {
    add: !!p.allowAdd,
    playback: !!p.allowPlayback && ctx.actor.canControl,
    skip: !!p.allowSkip && ctx.actor.canControl,
  };
}

/* ------------------------------------------------------------ providers -- */

export function spotifyFor(ctx: Ctx) {
  const secrets = decrypt<SpotifySecrets>(ctx.host.secrets);
  if (!secrets) throw new ProviderError("auth", "The driver needs to reconnect Spotify.", 401);
  return new SpotifyClient(ctx.host.id, secrets, ctx.host.settings?.deviceId || null);
}

export function catalogFor(ctx: Ctx) {
  return ctx.session.provider === "spotify"
    ? spotifyFor(ctx)
    : new AppleCatalog(ctx.host.settings?.storefront || "us");
}

const PLAYER_TIMEOUT_MS = 40_000;

/**
 * Keeps the stored playback state fresh.
 *  - Spotify: asks Spotify at most every ~3 s per session (shared by all screens).
 *  - Apple Music: the driver's player tab reports state; here we only detect
 *    that the tab went quiet.
 */
export async function refreshPlayback(ctx: Ctx, force = false): Promise<Playback> {
  const pb = ctx.session.playback || ({} as Playback);
  if (ctx.session.provider === "apple") {
    const seen = ctx.session.playerSeen ? Date.parse(ctx.session.playerSeen) : 0;
    if (Date.now() - seen > PLAYER_TIMEOUT_MS) return { ...emptyPlayback(), ...pb, isPlaying: false, error: "player_offline" };
    return { ...emptyPlayback(), ...pb };
  }

  const age = pb.at ? Date.now() - Date.parse(pb.at) : Infinity;
  if (!force && age < 3000) return { ...emptyPlayback(), ...pb };

  let fresh: Playback;
  try {
    fresh = await spotifyFor(ctx).playback();
  } catch (e) {
    fresh = { ...emptyPlayback(), error: e instanceof ProviderError ? (e.code as Playback["error"]) : "unavailable" };
  }
  const saved = await rpc<{ changed: boolean; skip: boolean; channel: string; version: number }>("rp_playback_save", {
    p_session: ctx.session.id,
    p_playback: fresh,
    p_player_seen: false,
  });
  if (saved.changed) await notify(saved);

  // The driver removed this song after Spotify already had it — skip it now.
  if (saved.skip) {
    try {
      await spotifyFor(ctx).control("next");
      await new Promise((r) => setTimeout(r, 400));
      return refreshPlayback({ ...ctx, session: { ...ctx.session, playback: { ...fresh, at: undefined } } }, true);
    } catch {
      /* best effort */
    }
  }
  return { ...fresh, at: new Date().toISOString() };
}

const emptyPlayback = (): Playback => ({ track: null, isPlaying: false, progressMs: 0, device: null, error: null });

/* -------------------------------------------------------------- state ---- */

export async function buildState(ctx: Ctx, playback?: Playback): Promise<SessionState> {
  const pb = playback || (await refreshPlayback(ctx));
  const s = await rpc<{
    version: number;
    participants: SessionState["participants"];
    queue: QueueItem[];
    recent: QueueItem[];
    commands: SessionState["commands"];
  }>("rp_state", { p_session: ctx.session.id, p_role: ctx.actor.kind, p_participant: ctx.actor.id });

  const isHost = ctx.actor.kind === "host";
  const origin = await requestOrigin();
  const publishable = env.supabasePublishable();

  return {
    role: ctx.actor.kind,
    me: { id: ctx.actor.id, name: ctx.actor.name, canControl: ctx.actor.canControl },
    session: {
      id: ctx.session.id,
      name: ctx.session.name,
      provider: ctx.session.provider,
      hostName: ctx.host.displayName,
      version: s.version,
      createdAt: ctx.session.createdAt,
      expiresAt: ctx.session.expiresAt,
      permissions: ctx.session.permissions,
      ...(isHost ? { code: ctx.session.code, joinUrl: `${origin}/j/${ctx.session.code}` } : {}),
    },
    caps: caps(ctx),
    playback: pb,
    // Passengers see who is in the car, but not the driver's controls for them.
    participants: isHost ? s.participants : s.participants.map((p) => ({ ...p, canControl: p.me ? p.canControl : true })),
    queue: s.queue,
    recent: s.recent,
    commands: isHost ? s.commands : [],
    realtime: publishable ? { url: env.supabaseUrl(), key: publishable, channel: ctx.session.channel } : null,
    serverTime: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------ dispatch --- */

/** Hands a newly added song to the provider (Spotify: its play queue). */
export async function dispatchItem(ctx: Ctx, item: QueueItem) {
  if (ctx.session.provider !== "spotify") return { ok: true, pending: true };
  try {
    await spotifyFor(ctx).enqueue(item.uri);
    await notify(await rpc("rp_queue_mark", { p_session: ctx.session.id, p_item: item.id, p_dispatch: "sent", p_error: null }));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof ProviderError ? e.message : "Couldn't reach Spotify.";
    await notify(await rpc("rp_queue_mark", { p_session: ctx.session.id, p_item: item.id, p_dispatch: "failed", p_error: msg }));
    return { ok: false, error: msg };
  }
}
