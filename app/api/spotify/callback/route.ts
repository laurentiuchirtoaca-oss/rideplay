import { NextResponse } from "next/server";
import { rpc } from "@/lib/db";
import { exchangeCode, SpotifyClient } from "@/lib/providers/spotify";
import {
  encrypt, getHostToken, hashToken, randomToken, requestOrigin, setHostToken, takeFlowCookie,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = await requestOrigin();
  const url = new URL(req.url);
  const expected = await takeFlowCookie("rp_oauth");
  const back = (q: string) => NextResponse.redirect(`${origin}/start?${q}`);

  if (url.searchParams.get("error")) return back("error=denied");
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("error=state");

  try {
    const secrets = await exchangeCode(code, `${origin}/api/spotify/callback`);
    const me = await new SpotifyClient("", secrets).me();
    const token = (await getHostToken()) || randomToken();
    await rpc("rp_host_save", {
      p_token_hash: hashToken(token),
      p_provider: "spotify",
      p_display_name: me.name,
      p_account_id: me.id,
      p_secrets: encrypt(secrets),
      p_settings: {},
    });
    await setHostToken(token);
    return back("step=device");
  } catch (e) {
    console.error("[spotify] callback failed", e);
    return back("error=connect");
  }
}
