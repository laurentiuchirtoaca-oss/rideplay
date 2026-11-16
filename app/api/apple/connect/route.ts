import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { rpc } from "@/lib/db";
import { configured } from "@/lib/env";
import { getHostToken, hashToken, randomToken, setHostToken } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Called after MusicKit authorised the driver's Apple Music account in the
 * browser. The Music User Token stays in the driver's browser (MusicKit keeps
 * it); the server only stores the storefront (country) for catalogue search.
 */
export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  if (!configured.apple() || !configured.database()) return fail("not_configured", "Apple Music isn't set up on this server.", 503);
  const b = await body<{ storefront?: string; name?: string }>(req);
  const storefront = String(b.storefront || "us").toLowerCase().replace(/[^a-z]/g, "").slice(0, 4) || "us";
  const token = (await getHostToken()) || randomToken();
  await rpc("rp_host_save", {
    p_token_hash: hashToken(token),
    p_provider: "apple",
    p_display_name: String(b.name || "Driver").slice(0, 40),
    p_account_id: null,
    p_secrets: null,
    p_settings: { storefront, deviceName: "This phone (RIDEPLAY player)" },
  });
  await setHostToken(token);
  return json({ ok: true });
});
