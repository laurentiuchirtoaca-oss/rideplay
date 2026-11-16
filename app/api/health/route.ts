import { handle, json } from "@/lib/api";
import { configured, env } from "@/lib/env";
import { rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Setup check: shows yes/no for each setting, never the secrets themselves. */
export const GET = handle(async () => {
  const key = env.supabaseSecret();
  const out: Record<string, string> = {
    supabaseUrl: /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(env.supabaseUrl())
      ? "ok"
      : env.supabaseUrl() ? "unusual (should be https://xxxx.supabase.co)" : "missing",
    supabaseSecretKey: !key
      ? "missing"
      : key.startsWith("sb_secret_") || (key.startsWith("eyJ") && key.length > 100)
        ? "ok"
        : key.startsWith("sb_publishable_")
          ? "WRONG: this is the publishable key, use the secret key"
          : `WRONG: doesn't look like a secret key (starts with "${key.slice(0, 4)}…")`,
    supabasePublishableKey: env.supabasePublishable()
      ? env.supabasePublishable().startsWith("sb_secret_") ? "WRONG: this is the SECRET key — never put it here" : "ok (instant updates)"
      : "not set (works, updates every few seconds)",
    sessionSecret: env.sessionSecret().length >= 32 ? "ok" : "missing or shorter than 32 characters",
    spotify: configured.spotify() ? "ok" : "not set",
    appleMusic: configured.apple() ? "ok" : "not set (optional)",
  };
  try {
    const r = await rpc<{ error?: string }>("rp_session_preview", { p_code: "HEALTHCHECK" });
    out.database = r?.error === "not_found" ? "ok" : "unexpected answer — run supabase/rideplay.sql again";
  } catch {
    out.database = "error — check the Supabase keys and run supabase/rideplay.sql";
  }
  return json(out);
});
