import "server-only";
import { createPrivateKey, sign } from "crypto";
import { env } from "../env";
import { ProviderError } from "./spotify";
import type { Album, Artist, BrowseResult, Playlist, SearchResult, Track } from "../types";

/**
 * Apple Music has two separate parts, and RIDEPLAY uses both:
 *  - Apple Music API (server): catalogue search and metadata, signed with a
 *    developer token. Works without the listener's account.
 *  - MusicKit on the Web (driver's browser): authorises the driver's Apple
 *    Music subscription and plays full songs *inside the RIDEPLAY page on the
 *    driver's phone*. Apple offers no API to remote-control the native Music
 *    app, so the driver's RIDEPLAY tab is the player and executes passengers'
 *    commands.
 */

let cached: { token: string; exp: number; origin: string } | null = null;

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** ES256-signed developer token (valid 12 h, cached). `origin` locks it to this site. */
export function developerToken(origin?: string) {
  const now = Math.floor(Date.now() / 1000);
  const o = origin || "";
  if (cached && cached.exp - now > 600 && cached.origin === o) return cached.token;
  const header = { alg: "ES256", kid: env.appleKeyId(), typ: "JWT" };
  const payload: Record<string, unknown> = { iss: env.appleTeamId(), iat: now, exp: now + 12 * 3600 };
  if (o) payload.origin = [o];
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = sign("sha256", Buffer.from(input), {
    key: createPrivateKey(env.applePrivateKey()),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  const token = `${input}.${sig}`;
  cached = { token, exp: now + 12 * 3600, origin: o };
  return token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const art = (a: Any, size = 300) =>
  a?.url ? String(a.url).replace("{w}", String(size)).replace("{h}", String(size)) : null;

export function mapSong(s: Any): Track | null {
  if (!s?.id || !s.attributes) return null;
  const a = s.attributes;
  return {
    trackId: s.id,
    uri: `apple:song:${s.id}`,
    title: a.name,
    artist: a.artistName || "",
    album: a.albumName || "",
    artwork: art(a.artwork),
    durationMs: a.durationInMillis ?? null,
    url: a.url || null,
    explicit: a.contentRating === "explicit",
  };
}
const mapArtist = (x: Any): Artist => ({
  id: x.id,
  name: x.attributes?.name,
  image: art(x.attributes?.artwork, 160),
  genres: (x.attributes?.genreNames || []).slice(0, 2),
});
const mapAlbum = (x: Any): Album => ({
  id: x.id,
  name: x.attributes?.name,
  artist: x.attributes?.artistName || "",
  image: art(x.attributes?.artwork),
  year: (x.attributes?.releaseDate || "").slice(0, 4),
  tracks: x.attributes?.trackCount,
});
const mapPlaylist = (x: Any): Playlist => ({
  id: x.id,
  uri: `apple:playlist:${x.id}`,
  name: x.attributes?.name,
  owner: x.attributes?.curatorName || "Apple Music",
  image: art(x.attributes?.artwork),
});

export class AppleCatalog {
  constructor(private storefront: string) {}

  private async call(path: string, query: Record<string, string> = {}) {
    const u = new URL(`/v1/catalog/${encodeURIComponent(this.storefront || "us")}${path}`, env.appleApi());
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    let res: Response;
    try {
      res = await fetch(u, {
        headers: { authorization: `Bearer ${developerToken()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ProviderError("unavailable", "Apple Music didn't respond. Try again in a moment.", 503);
    }
    if (res.status === 401 || res.status === 403)
      throw new ProviderError("auth", "The Apple Music developer key was rejected. Check the Apple settings.", 503);
    if (res.status === 404) throw new ProviderError("not_found", "Apple Music couldn't find that.", 404);
    if (res.status === 429) throw new ProviderError("rate_limited", "Apple Music is limiting requests. Try again shortly.", 429);
    if (!res.ok) throw new ProviderError("unavailable", "Apple Music didn't respond. Try again in a moment.", 503);
    return res.json();
  }

  /** Authoritative song details — never trust what a browser sent. */
  async track(id: string): Promise<Track | null> {
    const r = await this.call(`/songs/${encodeURIComponent(id)}`);
    return mapSong(r?.data?.[0]);
  }

  async search(q: string, type: string, offset = 0): Promise<SearchResult> {
    const map: Record<string, string> = { track: "songs", artist: "artists", album: "albums", playlist: "playlists" };
    const types = type === "all" ? "songs,artists,albums,playlists" : map[type] || "songs";
    const r = await this.call("/search", {
      term: q,
      types,
      limit: type === "all" ? "6" : "15",
      offset: String(offset),
    });
    const res = r?.results || {};
    return {
      tracks: ((res.songs?.data || []) as Any[]).map(mapSong).filter(Boolean) as Track[],
      artists: ((res.artists?.data || []) as Any[]).map(mapArtist),
      albums: ((res.albums?.data || []) as Any[]).map(mapAlbum),
      playlists: ((res.playlists?.data || []) as Any[]).map(mapPlaylist),
    };
  }

  async browse(kind: string, id: string): Promise<BrowseResult> {
    if (kind === "album") {
      const r = await this.call(`/albums/${encodeURIComponent(id)}`);
      const a = r.data?.[0];
      return {
        kind: "album",
        title: a.attributes.name,
        subtitle: `${a.attributes.artistName} · ${(a.attributes.releaseDate || "").slice(0, 4)}`,
        image: art(a.attributes.artwork, 600),
        tracks: ((a.relationships?.tracks?.data || []) as Any[]).map(mapSong).filter(Boolean) as Track[],
        playable: { uri: `apple:album:${a.id}`, id: a.id, type: "album" },
      };
    }
    if (kind === "artist") {
      const r = await this.call(`/artists/${encodeURIComponent(id)}`, { views: "top-songs,full-albums" });
      const a = r.data?.[0];
      return {
        kind: "artist",
        title: a.attributes.name,
        subtitle: (a.attributes.genreNames || []).slice(0, 3).join(" · ") || "Artist",
        image: art(a.attributes.artwork, 600),
        tracks: ((a.views?.["top-songs"]?.data || []) as Any[]).map(mapSong).filter(Boolean) as Track[],
        albums: ((a.views?.["full-albums"]?.data || []) as Any[]).map(mapAlbum),
      };
    }
    if (kind === "playlist") {
      const r = await this.call(`/playlists/${encodeURIComponent(id)}`);
      const p = r.data?.[0];
      return {
        kind: "playlist",
        title: p.attributes.name,
        subtitle: `Playlist · ${p.attributes.curatorName || "Apple Music"}`,
        image: art(p.attributes.artwork, 600),
        tracks: ((p.relationships?.tracks?.data || []) as Any[]).map(mapSong).filter(Boolean) as Track[],
        playable: { uri: `apple:playlist:${p.id}`, id: p.id, type: "playlist" },
      };
    }
    if (kind === "mine") {
      return {
        kind: "mine",
        title: "Driver's playlists",
        subtitle: "Apple Music",
        image: null,
        tracks: [],
        playlists: [],
        note: "Apple Music keeps the driver's library private to their own device, so passengers browse the Apple Music catalogue instead.",
      };
    }
    throw new ProviderError("bad_request", "Unknown browse type.");
  }
}
