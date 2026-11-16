import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { clientIp, hashToken, limit, randomToken, setPassengerToken } from "@/lib/security";

export const dynamic = "force-dynamic";

/** A passenger joins with the private code from the QR / link. No account needed. */
export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  if (!limit("join:" + (await clientIp()), 20, 60_000)) return fail("too_fast", "Too many attempts. Wait a minute.", 429);
  const b = await body<{ code?: string; name?: string }>(req);
  const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const token = randomToken();
  const r = await rpc<{ error?: string; sessionId: string; channel: string; version: number }>("rp_join", {
    p_code: code, p_token_hash: hashToken(token), p_name: String(b.name || "").slice(0, 40),
  });
  if (r.error === "ended") return fail("ended", "This session has ended.", 410);
  if (r.error === "full") return fail("full", "This session is full (12 passengers).", 409);
  if (r.error) return fail("not_found", "No session with that code.", 404);
  await setPassengerToken(r.sessionId, token);
  await notify(r);
  return json({ sessionId: r.sessionId });
});
