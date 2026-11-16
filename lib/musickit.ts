"use client";

/* Minimal typing for the parts of MusicKit on the Web (v3) RIDEPLAY uses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type MusicKitInstance = {
  authorize(): Promise<string>;
  unauthorize(): Promise<void>;
  isAuthorized: boolean;
  storefrontId?: string;
  storefrontCountryCode?: string;
  playbackState: number;
  isPlaying: boolean;
  currentPlaybackTime: number; // seconds
  currentPlaybackDuration: number; // seconds
  nowPlayingItem: Any;
  queue: { items: Any[]; position: number };
  setQueue(opts: Record<string, unknown>): Promise<unknown>;
  playNext(opts: Record<string, unknown>): Promise<unknown>;
  playLater(opts: Record<string, unknown>): Promise<unknown>;
  play(): Promise<unknown>;
  pause(): void | Promise<unknown>;
  skipToNextItem(): Promise<unknown>;
  skipToPreviousItem(): Promise<unknown>;
  addEventListener(name: string, cb: (...a: Any[]) => void): void;
  removeEventListener(name: string, cb: (...a: Any[]) => void): void;
};

declare global {
  interface Window {
    MusicKit?: Any;
  }
}

let loading: Promise<MusicKitInstance> | null = null;

/** Loads MusicKit JS from Apple's CDN and configures it with our developer token. */
export function loadMusicKit(src: string): Promise<MusicKitInstance> {
  if (loading) return loading;
  loading = (async () => {
    const tokenRes = await fetch("/api/apple/token", { cache: "no-store" });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) throw new Error(tokenData.error || "Apple Music isn't set up on this server.");

    if (!window.MusicKit) {
      await new Promise<void>((resolve, reject) => {
        const done = () => resolve();
        document.addEventListener("musickitloaded", done, { once: true });
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.dataset.webComponents = "";
        s.onerror = () => reject(new Error("Couldn't load Apple's MusicKit. Check your connection."));
        s.onload = () => {
          if (window.MusicKit?.configure) resolve();
        };
        document.head.appendChild(s);
        setTimeout(() => reject(new Error("MusicKit took too long to load.")), 20000);
      });
    }
    const mk = await window.MusicKit.configure({
      developerToken: tokenData.token,
      app: { name: "RIDEPLAY", build: "1.0.0" },
    });
    return (mk || window.MusicKit.getInstance()) as MusicKitInstance;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Converts MusicKit's now-playing item into RIDEPLAY's track shape. */
export function mkTrack(item: Any) {
  if (!item) return null;
  const a = item.attributes || item;
  const id = String(item.id || a.playParams?.catalogId || a.playParams?.id || "");
  if (!id) return null;
  const art = a.artwork?.url ? String(a.artwork.url).replace("{w}", "300").replace("{h}", "300") : null;
  return {
    trackId: id,
    uri: `apple:song:${id}`,
    title: a.name || item.title || "Unknown",
    artist: a.artistName || item.artistName || "",
    album: a.albumName || item.albumName || "",
    artwork: art,
    durationMs: a.durationInMillis ?? (item.playbackDuration ? Math.round(item.playbackDuration) : null),
    url: a.url || null,
  };
}
