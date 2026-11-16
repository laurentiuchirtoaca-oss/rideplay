"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Library, Loader2, Play, Plus, Search, SearchX, X } from "lucide-react";
import { Artwork } from "./music";
import { Button, Empty, Segmented, Sheet, Skeleton, cx } from "./ui";
import { api, ApiFail, formatMs, providerName } from "@/lib/client";
import type { Album, Artist, BrowseResult, Playlist, SearchResult, SessionState, Track } from "@/lib/types";

type Filter = "all" | "track" | "artist" | "album" | "playlist";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "track", label: "Songs" },
  { value: "artist", label: "Artists" },
  { value: "album", label: "Albums" },
  { value: "playlist", label: "Playlists" },
];

const EMPTY: SearchResult = { tracks: [], artists: [], albums: [], playlists: [] };

export default function MusicSearch({
  state,
  onAdd,
  onPlayContext,
  autoFocus,
}: {
  state: SessionState;
  onAdd: (t: Track) => Promise<boolean>;
  onPlayContext: (uri: string, name: string) => Promise<void>;
  autoFocus?: boolean;
}) {
  const sid = state.session.id;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [res, setRes] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browse, setBrowse] = useState<{ kind: string; id: string; title: string } | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(
    async (query: string, f: Filter, offset = 0) => {
      ctrl.current?.abort();
      if (!query.trim()) {
        setRes(EMPTY);
        setLoading(false);
        setError(null);
        return;
      }
      const ac = new AbortController();
      ctrl.current = ac;
      offset ? setMore(true) : setLoading(true);
      setError(null);
      try {
        const r = await api<SearchResult>(
          `/api/session/${sid}/search?q=${encodeURIComponent(query)}&type=${f}&offset=${offset}`,
          { signal: ac.signal }
        );
        setRes((prev) =>
          offset
            ? { ...prev, tracks: [...prev.tracks, ...r.tracks], albums: [...prev.albums, ...r.albums], artists: [...prev.artists, ...r.artists], playlists: [...prev.playlists, ...r.playlists] }
            : r
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof ApiFail ? e.message : "Search failed.");
      } finally {
        if (ctrl.current === ac) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [sid]
  );

  useEffect(() => {
    const t = setTimeout(() => run(q, filter), q ? 320 : 0);
    return () => clearTimeout(t);
  }, [q, filter, run]);

  const queued = useMemo(() => new Set(state.queue.map((i) => i.trackId)), [state.queue]);
  const hasAny = res.tracks.length + res.artists.length + res.albums.length + res.playlists.length > 0;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Songs, artists or albums"
          aria-label={`Search ${providerName(state.session.provider)}`}
          className="h-[52px] w-full rounded-2xl border border-line bg-card pl-12 pr-11 text-[16px] outline-none transition placeholder:text-muted focus:border-accent/60 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-card-2 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Segmented label="Result type" value={filter} onChange={setFilter} options={FILTERS} className="-mx-1 mt-3 px-1 pb-1" />

      <div className="mt-4">
        {!q.trim() ? (
          <StartBrowsing state={state} onOpenMine={() => setBrowse({ kind: "mine", id: "me", title: "Driver's playlists" })} />
        ) : loading ? (
          <ResultsSkeleton />
        ) : error ? (
          <Empty icon={<SearchX className="h-6 w-6" />} title="Search didn't work" action={<Button size="sm" onClick={() => run(q, filter)}>Try again</Button>}>
            {error}
          </Empty>
        ) : !hasAny ? (
          <Empty icon={<SearchX className="h-6 w-6" />} title={`No results for “${q.trim()}”`}>
            Check the spelling, or try the artist&apos;s name.
          </Empty>
        ) : (
          <div className="space-y-7">
            {res.tracks.length > 0 && (
              <section>
                {filter === "all" && <h3 className="mb-2 text-sm font-semibold text-muted">Songs</h3>}
                <ul className="space-y-0.5">
                  {res.tracks.map((t) => (
                    <TrackRow key={t.trackId} track={t} inQueue={queued.has(t.trackId)} canAdd={state.caps.add} onAdd={onAdd} />
                  ))}
                </ul>
                {filter === "track" && res.tracks.length >= 10 && res.tracks.length % 10 === 0 && (
                  <Button variant="ghost" size="sm" className="mt-2" loading={more} onClick={() => run(q, "track", res.tracks.length)}>
                    Show more songs
                  </Button>
                )}
              </section>
            )}
            {res.artists.length > 0 && (
              <section>
                {filter === "all" && <h3 className="mb-2 text-sm font-semibold text-muted">Artists</h3>}
                <Grid>
                  {res.artists.map((a) => (
                    <ArtistTile key={a.id} artist={a} onOpen={() => setBrowse({ kind: "artist", id: a.id, title: a.name })} />
                  ))}
                </Grid>
              </section>
            )}
            {res.albums.length > 0 && (
              <section>
                {filter === "all" && <h3 className="mb-2 text-sm font-semibold text-muted">Albums</h3>}
                <Grid>
                  {res.albums.map((a) => (
                    <CoverTile key={a.id} image={a.image} title={a.name} subtitle={[a.artist, a.year].filter(Boolean).join(", ")} onOpen={() => setBrowse({ kind: "album", id: a.id, title: a.name })} />
                  ))}
                </Grid>
              </section>
            )}
            {res.playlists.length > 0 && (
              <section>
                {filter === "all" && <h3 className="mb-2 text-sm font-semibold text-muted">Playlists</h3>}
                <Grid>
                  {res.playlists.map((p) => (
                    <CoverTile key={p.id} image={p.image} title={p.name} subtitle={p.owner ? `By ${p.owner}` : "Playlist"} onOpen={() => setBrowse({ kind: "playlist", id: p.id, title: p.name })} />
                  ))}
                </Grid>
              </section>
            )}
          </div>
        )}
      </div>

      <BrowseSheet
        state={state}
        target={browse}
        onClose={() => setBrowse(null)}
        onOpen={(b) => setBrowse(b)}
        onAdd={onAdd}
        onPlayContext={onPlayContext}
        queued={queued}
      />
    </div>
  );
}

/* ------------------------------------------------------------- pieces -- */

function StartBrowsing({ state, onOpenMine }: { state: SessionState; onOpenMine: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Search the {providerName(state.session.provider)} catalogue. Songs you add play on the driver&apos;s phone, through the car speakers.
      </p>
      {state.session.provider === "spotify" && (
        <button onClick={onOpenMine} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition hover:bg-card-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent-ink">
            <Library className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{state.session.hostName}&apos;s playlists</span>
            <span className="block text-sm text-muted">Pick from the driver&apos;s own Spotify playlists</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </button>
      )}
      {!state.caps.add && (
        <p className="rounded-2xl bg-warn/10 p-3 text-sm text-warn">The driver has paused adding songs. You can still browse.</p>
      )}
    </div>
  );
}

export function TrackRow({
  track,
  inQueue,
  canAdd,
  onAdd,
  index,
}: {
  track: Track;
  inQueue: boolean;
  canAdd: boolean;
  onAdd: (t: Track) => Promise<boolean>;
  index?: number;
}) {
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const done = inQueue || justAdded;

  const add = async () => {
    if (adding || done) return;
    setAdding(true);
    const ok = await onAdd(track);
    setAdding(false);
    if (ok) setJustAdded(true);
  };

  return (
    <li className="group flex items-center gap-3 rounded-2xl p-2 pr-1.5 hover:bg-card-2/60">
      {index !== undefined ? (
        <span className="w-6 shrink-0 text-center text-sm text-muted tabular">{index}</span>
      ) : (
        <Artwork src={track.artwork} size={48} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {track.title}
          {track.explicit && (
            <span className="ml-2 inline-flex h-4 items-center rounded-[4px] bg-card-2 px-1 align-[2px] text-[10px] font-semibold text-muted" title="Explicit">
              E
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted">
          {track.artist}
          {index === undefined && track.album ? <span className="hidden sm:inline"> — {track.album}</span> : null}
        </p>
      </div>
      <span className="hidden text-xs text-muted tabular sm:block">{formatMs(track.durationMs)}</span>
      <button
        onClick={add}
        disabled={!canAdd || done || adding}
        aria-label={done ? `${track.title} is in the queue` : `Add ${track.title} to queue`}
        title={!canAdd ? "The driver has paused adding songs" : done ? "In the queue" : "Add to queue"}
        className={cx(
          "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition active:scale-95",
          done ? "bg-accent/12 text-accent-ink" : "bg-accent text-on-accent hover:brightness-105 disabled:bg-card-2 disabled:text-muted"
        )}
      >
        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        <span className="hidden min-[380px]:inline">{done ? "Queued" : "Add"}</span>
      </button>
    </li>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function ArtistTile({ artist, onOpen }: { artist: Artist; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group rounded-2xl p-2 text-left transition hover:bg-card-2/60">
      <Artwork src={artist.image} size={0} rounded="rounded-full" className="!h-auto !w-full aspect-square" />
      <p className="mt-2 truncate text-sm font-medium">{artist.name}</p>
      <p className="truncate text-xs text-muted">Artist</p>
    </button>
  );
}

function CoverTile({ image, title, subtitle, onOpen }: { image: string | null; title: string; subtitle: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group rounded-2xl p-2 text-left transition hover:bg-card-2/60">
      <Artwork src={image} size={0} rounded="rounded-xl" className="!h-auto !w-full aspect-square" />
      <p className="mt-2 truncate text-sm font-medium">{title}</p>
      <p className="truncate text-xs text-muted">{subtitle}</p>
    </button>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-1" aria-busy="true" aria-label="Searching">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-10 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- browse sheet -- */

function BrowseSheet({
  state,
  target,
  onClose,
  onOpen,
  onAdd,
  onPlayContext,
  queued,
}: {
  state: SessionState;
  target: { kind: string; id: string; title: string } | null;
  onClose: () => void;
  onOpen: (t: { kind: string; id: string; title: string }) => void;
  onAdd: (t: Track) => Promise<boolean>;
  onPlayContext: (uri: string, name: string) => Promise<void>;
  queued: Set<string>;
}) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const key = target ? `${target.kind}:${target.id}` : "";

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setData(null);
    setError(null);
    api<BrowseResult>(`/api/session/${state.session.id}/browse?kind=${target.kind}&id=${encodeURIComponent(target.id)}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof ApiFail ? e.message : "Couldn't open this."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const play = async () => {
    if (!data?.playable) return;
    setStarting(true);
    try {
      await onPlayContext(data.playable.uri, data.title);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Sheet open={!!target} onClose={onClose} title={target?.title || ""} wide>
      {error ? (
        <Empty icon={<SearchX className="h-6 w-6" />} title="Couldn't open this">
          {error}
        </Empty>
      ) : !data ? (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          </div>
          <ResultsSkeleton />
        </div>
      ) : (
        <div>
          {data.kind !== "mine" && (
            <div className="mb-5 flex items-center gap-4">
              <Artwork src={data.image} size={96} rounded={data.kind === "artist" ? "rounded-full" : "rounded-xl"} />
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-tight tracking-tight">{data.title}</p>
                <p className="mt-1 text-sm text-muted">{data.subtitle}</p>
                {data.playable && state.caps.playback && (
                  <Button size="sm" variant="outline" className="mt-3" loading={starting} onClick={play}>
                    <Play className="h-4 w-4" fill="currentColor" /> Play {data.playable.type} now
                  </Button>
                )}
              </div>
            </div>
          )}
          {data.note && <p className="mb-4 rounded-2xl bg-card-2 p-3 text-sm text-muted">{data.note}</p>}

          {data.tracks.length > 0 && (
            <>
              {data.kind === "artist" && <h3 className="mb-2 text-sm font-semibold text-muted">Songs</h3>}
              <ul className="space-y-0.5">
                {data.tracks.map((t, i) => (
                  <TrackRow
                    key={`${t.trackId}-${i}`}
                    track={t}
                    index={data.kind === "album" ? i + 1 : undefined}
                    inQueue={queued.has(t.trackId)}
                    canAdd={state.caps.add}
                    onAdd={onAdd}
                  />
                ))}
              </ul>
            </>
          )}

          {!!data.albums?.length && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-muted">Albums</h3>
              <Grid>
                {data.albums.map((a: Album) => (
                  <CoverTile key={a.id} image={a.image} title={a.name} subtitle={a.year || "Album"} onOpen={() => onOpen({ kind: "album", id: a.id, title: a.name })} />
                ))}
              </Grid>
            </div>
          )}

          {data.kind === "mine" && (
            data.playlists?.length ? (
              <Grid>
                {data.playlists.map((p: Playlist) => (
                  <CoverTile key={p.id} image={p.image} title={p.name} subtitle={p.tracks ? `${p.tracks} songs` : "Playlist"} onOpen={() => onOpen({ kind: "playlist", id: p.id, title: p.name })} />
                ))}
              </Grid>
            ) : (
              !data.note && <Empty icon={<Library className="h-6 w-6" />} title="No playlists yet">The driver has no playlists on this account.</Empty>
            )
          )}
        </div>
      )}
    </Sheet>
  );
}
