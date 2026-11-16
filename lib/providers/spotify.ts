import "server-only";
import { env } from "../env";
import { encrypt } from "../security";
import { rpc } from "../db";
import type { Album, Artist, BrowseResult, Playback, Playlist, SearchResult, Track } from "../types";

/**
 * Spotify Web API — what RIDEPLAY uses and why:
 *  - user-read-playback-state     see what is playing and on which device
 *  - user-modify-playback-state   play / pause / skip / add to queue (Spotify Premium)
 *  - user-read-currently-playing  current track
 *  - playlist-read-private        let passengers pick from the driver's own playlists
 * Nothing else (no email, no library changes, no following).
 */
export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
];

export type SpotifySecrets = { accessToken: string; refreshToken: string; expiresAt: number };

export class ProviderError extends Error {
  constructor(public code: Playback["error"] | "bad_request" | "not_found", message: string, public status = 400) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  premium_required: "Spotify only allows remote control with a Spotify Premium account.",
  no_device:
    "Spotify isn't active on the driver's phone. Open Spotify there and start any song, then try again.",
  auth: "The driver's Spotify connection expired. The driver needs to reconnect Spotify.",
  rate_limited: "Spotify is limiting requests right now. Try again in a few seconds.",
  unavailable: "Spotify didn't respond. Try again in a moment.",
};

export function authorizeUrl(redirectUri: string, state: string) {
  const u = new URL("/authorize", env.spotifyAccounts());
  u.search = new URLSearchParams({
    client_id: env.spotifyClientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
    show_dialog: "true",
  }).toString();
  return u.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(new URL("/api/token", env.spotifyAccounts()), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization:
        "Basic " + Buffer.from(`${env.spotifyClientId()}:${env.spotifyClientSecret()}`).toString("base64"),
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[spotify] token request failed", res.status, data);
    throw new ProviderError("auth", data.error_description || MESSAGES.auth, 401);
  }
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function exchangeCode(code: string, redirectUri: string): Promise<SpotifySecrets> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token || "",
    expiresAt: Date.now() + t.expires_in * 1000,
  };
}

/* ------------------------------------------------------------- mapping -- */

type Img = { url: string; width?: number | null }[] | undefined;

function pickImage(images: Img, target = 300) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((i) => (i.width || 0) >= target) || sorted[sorted.length - 1]).url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function mapTrack(t: Any, albumOverride?: Any): Track | null {
  if (!t || t.type !== "track" || !t.id) return null;
  const album = albumOverride || t.album;
  return {
    trackId: t.id,
    uri: t.uri,
    title: t.name,
    artist: (t.artists || []).map((a: Any) => a.name).join(", "),
    album: album?.name || "",
    artwork: pickImage(album?.images),
    durationMs: t.duration_ms ?? null,
    url: t.external_urls?.spotify || null,
    explicit: !!t.explicit,
  };
}

const mapArtist = (a: Any): Artist => ({
  id: a.id,
  name: a.name,
  image: pickImage(a.images, 160),
  genres: (a.genres || []).slice(0, 2),
});
const mapAlbum = (a: Any): Album => ({
  id: a.id,
  name: a.name,
  artist: (a.artists || []).map((x: Any) => x.name).join(", "),
  image: pickImage(a.images),
  year: (a.release_date || "").slice(0, 4),
  tracks: a.total_tracks,
});
const mapPlaylist = (p: Any): Playlist => ({
  id: p.id,
  uri: p.uri,
  name: p.name,
  owner: p.owner?.display_name || "",
  image: pickImage(p.images),
  tracks: p.items?.total ?? p.tracks?.total,
});

/* -------------------------------------------------------------- client -- */

export class SpotifyClient {
  constructor(private hostId: string, private secrets: SpotifySecrets, private deviceId?: string | null) {}

  private async token() {
    if (this.secrets.expiresAt - Date.now() > 60_000) return this.secrets.accessToken;
    if (!this.secrets.refreshToken) throw new ProviderError("auth", MESSAGES.auth, 401);
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: this.secrets.refreshToken });
    this.secrets = {
      accessToken: t.access_token,
      refreshToken: t.refresh_token || this.secrets.refreshToken,
      expiresAt: Date.now() + t.expires_in * 1000,
    };
    await rpc("rp_host_update", {
      p_host: this.hostId, p_secrets: encrypt(this.secrets), p_settings: null, p_display_name: null,
    });
    return this.secrets.accessToken;
  }

  private async call(method: string, path: string, opts: { query?: Record<string, string>; body?: unknown } = {}) {
    const u = new URL("/v1" + path, env.spotifyApi());
    for (const [k, v] of Object.entries(opts.query || {})) if (v !== "") u.searchParams.set(k, v);
    let res: Response;
    try {
      res = await fetch(u, {
        method,
        headers: {
          authorization: `Bearer ${await this.token()}`,
          ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("unavailable", MESSAGES.unavailable, 503);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    let data: Any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (res.ok) return data;

    const reason: string = data?.error?.reason || "";
    const message: string = data?.error?.message || "";
    console.warn("[spotify]", method, path, res.status, reason || message);
    if (res.status === 401) throw new ProviderError("auth", MESSAGES.auth, 401);
    if (res.status === 429) throw new ProviderError("rate_limited", MESSAGES.rate_limited, 429);
    if (reason === "PREMIUM_REQUIRED" || /premium/i.test(message))
      throw new ProviderError("premium_required", MESSAGES.premium_required, 403);
    if (reason === "NO_ACTIVE_DEVICE" || (res.status === 404 && path.startsWith("/me/player")))
      throw new ProviderError("no_device", MESSAGES.no_device, 409);
    if (res.status === 404) throw new ProviderError("not_found", "Spotify couldn't find that.", 404);
    if (res.status === 403)
      throw new ProviderError("bad_request", message ? `Spotify refused: ${message}` : "Spotify refused the command.", 403);
    if (res.status >= 500) throw new ProviderError("unavailable", MESSAGES.unavailable, 503);
    throw new ProviderError("bad_request", message || "Spotify rejected the request.", 400);
  }

  private deviceQuery(): Record<string, string> {
    return this.deviceId ? { device_id: this.deviceId } : {};
  }

  /* ---- account ---- */

  async me() {
    const m = await this.call("GET", "/me");
    return { id: m?.id as string, name: (m?.display_name || m?.id || "Driver") as string };
  }

  async devices() {
    const d = await this.call("GET", "/me/player/devices");
    return ((d?.devices || []) as Any[]).map((x) => ({
      id: x.id as string | null,
      name: x.name as string,
      type: x.type as string,
      active: !!x.is_active,
      restricted: !!x.is_restricted,
    }));
  }

  /** Makes the chosen device the active one without starting playback. */
  async transfer(deviceId: string) {
    await this.call("PUT", "/me/player", { body: { device_ids: [deviceId], play: false } });
  }

  /* ---- playback ---- */

  async playback(): Promise<Playback> {
    try {
      const p = await this.call("GET", "/me/player", { query: { additional_types: "track" } });
      if (!p) return { track: null, isPlaying: false, progressMs: 0, device: null, error: "no_device" };
      return {
        track: mapTrack(p.item),
        isPlaying: !!p.is_playing,
        progressMs: p.progress_ms ?? 0,
        device: p.device ? { name: p.device.name, type: p.device.type } : null,
        error: null,
      };
    } catch (e) {
      if (e instanceof ProviderError && (e.code === "auth" || e.code === "rate_limited" || e.code === "unavailable"))
        return { track: null, isPlaying: false, progressMs: 0, device: null, error: e.code };
      throw e;
    }
  }

  async control(action: "play" | "pause" | "next" | "previous") {
    const q = this.deviceQuery();
    if (action === "play") await this.call("PUT", "/me/player/play", { query: q });
    else if (action === "pause") await this.call("PUT", "/me/player/pause", { query: q });
    else if (action === "next") await this.call("POST", "/me/player/next", { query: q });
    else await this.call("POST", "/me/player/previous", { query: q });
  }

  async enqueue(uri: string) {
    await this.call("POST", "/me/player/queue", { query: { uri, ...this.deviceQuery() } });
  }

  async playContext(uri: string) {
    await this.call("PUT", "/me/player/play", { query: this.deviceQuery(), body: { context_uri: uri } });
  }

  /* ---- catalogue ---- */

  /** Authoritative song details — never trust what a browser sent. */
  async track(id: string): Promise<Track | null> {
    const t = await this.call("GET", `/tracks/${encodeURIComponent(id)}`, { query: { market: "from_token" } });
    return mapTrack(t);
  }

  async search(q: string, type: string, offset = 0): Promise<SearchResult> {
    const types = type === "all" ? ["track", "artist", "album", "playlist"] : [type];
    const s = await this.call("GET", "/search", {
      query: {
        q,
        type: types.join(","),
        // Spotify caps search pages at 10 results (Feb 2026 change).
        limit: type === "all" ? "6" : "10",
        offset: String(offset),
        market: "from_token",
      },
    });
    return {
      tracks: ((s?.tracks?.items || []) as Any[]).map((t) => mapTrack(t)).filter(Boolean) as Track[],
      artists: ((s?.artists?.items || []) as Any[]).filter(Boolean).map(mapArtist),
      albums: ((s?.albums?.items || []) as Any[]).filter(Boolean).map(mapAlbum),
      playlists: ((s?.playlists?.items || []) as Any[]).filter(Boolean).map(mapPlaylist),
    };
  }

  async browse(kind: string, id: string): Promise<BrowseResult> {
    if (kind === "album") {
      const a = await this.call("GET", `/albums/${encodeURIComponent(id)}`, { query: { market: "from_token" } });
      return {
        kind: "album",
        title: a.name,
        subtitle: `${(a.artists || []).map((x: Any) => x.name).join(", ")} · ${(a.release_date || "").slice(0, 4)}`,
        image: pickImage(a.images, 600),
        tracks: ((a.tracks?.items || []) as Any[])
          .map((t) => mapTrack({ ...t, type: "track" }, a))
          .filter(Boolean) as Track[],
        playable: { uri: a.uri, id: a.id, type: "album" },
      };
    }
    if (kind === "artist") {
      const a = await this.call("GET", `/artists/${encodeURIComponent(id)}`);
      // "Top tracks" was removed from the API in 2026 — use a filtered search instead.
      const [songs, albums] = await Promise.all([
        this.call("GET", "/search", {
          query: { q: `artist:"${a.name}"`, type: "track", limit: "10", market: "from_token" },
        }),
        this.call("GET", `/artists/${encodeURIComponent(id)}/albums`, {
          query: { include_groups: "album,single", limit: "10", market: "from_token" },
        }),
      ]);
      return {
        kind: "artist",
        title: a.name,
        subtitle: (a.genres || []).slice(0, 3).join(" · ") || "Artist",
        image: pickImage(a.images, 600),
        tracks: ((songs?.tracks?.items || []) as Any[])
          .map((t) => mapTrack(t))
          .filter((t): t is Track => !!t && t.artist.toLowerCase().includes(a.name.toLowerCase())),
        albums: ((albums?.items || []) as Any[]).map(mapAlbum),
      };
    }
    if (kind === "playlist") {
      const p = await this.call("GET", `/playlists/${encodeURIComponent(id)}`, { query: { market: "from_token" } });
      const items = ((p.items?.items || []) as Any[])
        .map((i) => mapTrack(i.item || i.track))
        .filter(Boolean) as Track[];
      return {
        kind: "playlist",
        title: p.name,
        subtitle: `Playlist · ${p.owner?.display_name || ""}`,
        image: pickImage(p.images, 600),
        tracks: items,
        playable: { uri: p.uri, id: p.id, type: "playlist" },
        // Spotify only returns the songs of playlists the driver owns or collaborates on.
        note: items.length
          ? undefined
          : "Spotify only shows the songs of the driver's own playlists. You can still start this playlist as a whole.",
      };
    }
    if (kind === "mine") {
      const p = await this.call("GET", "/me/playlists", { query: { limit: "20" } });
      return {
        kind: "mine",
        title: "Driver's playlists",
        subtitle: "From the driver's Spotify library",
        image: null,
        tracks: [],
        playlists: ((p?.items || []) as Any[]).filter(Boolean).map(mapPlaylist),
      };
    }
    throw new ProviderError("bad_request", "Unknown browse type.");
  }
}
