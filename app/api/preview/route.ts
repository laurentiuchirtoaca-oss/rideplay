import { fail, handle, json } from "@/lib/api";
import { rpc } from "@/lib/db";
import { clientIp, limit } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Public info for the join screen. Codes are random, so guessing is impractical; also rate-limited. */
export const GET = handle(async (req: Request) => {
  if (!limit("preview:" + (await clientIp()), 30, 60_000)) return fail("too_fast", "Too many attempts. Wait a minute.", 429);
  const code = (new URL(req.url).searchParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (code.length < 6) return fail("not_found", "That code doesn't look right.", 404);
  const r = await rpc<{ error?: string }>("rp_session_preview", { p_code: code });
  if (r.error === "ended") return fail("ended", "This session has ended.", 410);
  if (r.error) return fail("not_found", "No session with that code. Check the link or ask the driver for a new one.", 404);
  return json(r);
});
