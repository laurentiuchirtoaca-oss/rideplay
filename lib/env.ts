import "server-only";

const clean = (v?: string) =>
  (v || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/^Bearer\s+/i, "");

/** Accepts a pasted URL with extra path (e.g. /rest/v1/) and keeps only the origin. */
function origin(v?: string) {
  try {
    return new URL(clean(v)).origin;
  } catch {
    return "";
  }
}

export const env = {
  supabaseUrl: () => origin(process.env.SUPABASE_URL),
  supabaseSecret: () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  /** Optional. Enables instant (websocket) updates; without it the app polls. */
  supabasePublishable: () => clean(process.env.SUPABASE_PUBLISHABLE_KEY),
  sessionSecret: () => clean(process.env.SESSION_SECRET),

  spotifyClientId: () => clean(process.env.SPOTIFY_CLIENT_ID),
  spotifyClientSecret: () => clean(process.env.SPOTIFY_CLIENT_SECRET),
  spotifyApi: () => origin(process.env.SPOTIFY_API_BASE) || "https://api.spotify.com",
  spotifyAccounts: () => origin(process.env.SPOTIFY_ACCOUNTS_BASE) || "https://accounts.spotify.com",

  appleTeamId: () => clean(process.env.APPLE_TEAM_ID),
  appleKeyId: () => clean(process.env.APPLE_KEY_ID),
  /** Contents of the .p8 file. Literal "\n" sequences are accepted. */
  applePrivateKey: () => (process.env.APPLE_PRIVATE_KEY || "").trim().replace(/\\n/g, "\n"),
  appleApi: () => origin(process.env.APPLE_MUSIC_API_BASE) || "https://api.music.apple.com",
  musicKitSrc: () =>
    clean(process.env.MUSICKIT_JS_URL) || "https://js-cdn.music.apple.com/musickit/v3/musickit.js",
};

export const configured = {
  database: () => !!env.supabaseUrl() && !!env.supabaseSecret() && env.sessionSecret().length >= 32,
  spotify: () => !!env.spotifyClientId() && !!env.spotifyClientSecret(),
  apple: () => !!env.appleTeamId() && !!env.appleKeyId() && env.applePrivateKey().includes("PRIVATE KEY"),
};
