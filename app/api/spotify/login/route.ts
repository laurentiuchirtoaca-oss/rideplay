import { NextResponse } from "next/server";
import { configured } from "@/lib/env";
import { authorizeUrl } from "@/lib/providers/spotify";
import { randomToken, requestOrigin, setFlowCookie } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = await requestOrigin();
  if (!configured.spotify() || !configured.database())
    return NextResponse.redirect(`${origin}/start?error=spotify_not_configured`);
  const state = randomToken();
  await setFlowCookie("rp_oauth", state);
  return NextResponse.redirect(authorizeUrl(`${origin}/api/spotify/callback`, state));
}
