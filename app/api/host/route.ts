import { configured, env } from "@/lib/env";
import { handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { clearHostToken } from "@/lib/security";
import { currentHost } from "@/lib/host";

export const dynamic = "force-dynamic";

/** Driver status: connected provider, chosen device, live session. */
export const GET = handle(async () => {
  const h = await currentHost();
  return json({
    configured: { database: configured.database(), spotify: configured.spotify(), apple: configured.apple() },
    musicKitSrc: configured.apple() ? env.musicKitSrc() : null,
    host: h ? { provider: h.provider, displayName: h.displayName, settings: h.settings, session: h.session } : null,
  });
});

/** Disconnect the music account: deletes stored tokens and ends the session. */
export const DELETE = handle(async (req: Request) => {
  sameOrigin(req);
  const h = await currentHost();
  if (h) await notify((await rpc("rp_host_delete", { p_host: h.id })) as never);
  await clearHostToken();
  return json({ ok: true });
});
