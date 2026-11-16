// Shared shapes used by the browser and the server.

export type ProviderId = "spotify" | "apple";

export type Track = {
  trackId: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  durationMs: number | null;
  url: string | null;
  explicit?: boolean;
};

export type Artist = { id: string; name: string; image: string | null; genres?: string[] };
export type Album = { id: string; name: string; artist: string; image: string | null; year?: string; tracks?: number };
export type Playlist = { id: string; uri: string; name: string; owner: string; image: string | null; tracks?: number };

export type SearchResult = {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
};

export type BrowseResult = {
  kind: "album" | "artist" | "playlist" | "mine";
  title: string;
  subtitle: string;
  image: string | null;
  tracks: Track[];
  albums?: Album[];
  playlists?: Playlist[];
  /** Playlist / album that can be started as a whole (needs playback permission). */
  playable?: { uri: string; id: string; type: "playlist" | "album" } | null;
  note?: string;
};

export type Playback = {
  track: Track | null;
  isPlaying: boolean;
  progressMs: number;
  /** ISO time the progress was measured. */
  at?: string;
  device?: { name: string; type: string } | null;
  /** Machine-readable reason when the provider can't report or control playback. */
  error?: "no_device" | "premium_required" | "auth" | "rate_limited" | "player_offline" | "unavailable" | null;
};

export type Permissions = {
  allowAdd: boolean;
  allowPlayback: boolean;
  allowSkip: boolean;
  maxPerPerson: number;
};

export type QueueItem = Track & {
  id: string;
  position: number;
  provider: ProviderId;
  addedBy: string | null;
  addedByName: string;
  status: "queued" | "playing" | "played" | "removed";
  dispatch: "pending" | "sent" | "failed";
  error: string | null;
  skipOnPlay: boolean;
  createdAt: string;
};

export type Participant = {
  id: string;
  name: string;
  canControl: boolean;
  joinedAt: string;
  online: boolean;
  me: boolean;
};

export type Command = { id: number; kind: string; payload: Record<string, unknown>; queueId: string | null };

export type SessionState = {
  role: "host" | "participant";
  me: { id: string | null; name: string; canControl: boolean };
  session: {
    id: string;
    name: string;
    provider: ProviderId;
    hostName: string;
    version: number;
    createdAt: string;
    expiresAt: string;
    permissions: Permissions;
    /** Driver only. */
    code?: string;
    joinUrl?: string;
  };
  caps: { add: boolean; playback: boolean; skip: boolean };
  playback: Playback;
  participants: Participant[];
  queue: QueueItem[];
  recent: QueueItem[];
  commands: Command[];
  realtime: { url: string; key: string; channel: string } | null;
  serverTime: string;
  /** Set in the browser when the state arrived. */
  receivedAt?: number;
};

export type EndedState = { ended: true; reason: string; name?: string };
export type ApiError = { error: string; code?: string };
