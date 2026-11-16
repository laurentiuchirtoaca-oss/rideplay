import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { rpc } from "@/lib/db";
import { decrypt } from "@/lib/security";
import { SpotifyClient, type SpotifySecrets } from "@/lib/providers/spotify";
import { currentHost } from "@/lib/host";

export const dynamic = "force-dynamic";

async function client() {
  const h = await currentHost();
  if (!h || h.provider !== "spotify") return null;
  const s = decrypt<SpotifySecrets>(h.secrets);
  return s ? { h, c: new SpotifyClient(h.id, s) } : null;
}

/** Spotify devices the driver can play on (Spotify must be open there). */
export const GET = handle(async () => {
  const x = await client();
  if (!x) return fail("not_connected", "Connect Spotify first.", 401);
  return json({ devices: await x.c.devices(), selected: x.h.settings?.deviceId || null });
});

/** Confirms the playback device (driver's phone) and makes it active. */
export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  const x = await client();
  if (!x) return fail("not_connected", "Connect Spotify first.", 401);
  const { deviceId, deviceName } = await body<{ deviceId?: string; deviceName?: string }>(req);
  if (deviceId) {
    try {
      await x.c.transfer(deviceId);
    } catch {
      /* the device may already be active, or Spotify app in background — keep the choice anyway */
    }
  }
  await rpc("rp_host_update", {
    p_host: x.h.id, p_secrets: null,
    p_settings: { deviceId: deviceId || "", deviceName: deviceName || "" },
    p_display_name: null,
  });
  return json({ ok: true });
});
