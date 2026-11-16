import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { randomCode, randomToken } from "@/lib/security";
import { currentHost } from "@/lib/host";

export const dynamic = "force-dynamic";

/** Create a new car session (ends any previous one). */
export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  const h = await currentHost();
  if (!h) return fail("not_connected", "Connect your music service first.", 401);
  const { name } = await body<{ name?: string }>(req);
  const r = await rpc<{ id: string; code: string; error?: string; ended: { channel: string; version: number }[] }>(
    "rp_session_create",
    { p_host: h.id, p_name: String(name || ""), p_code: randomCode(8), p_channel: "rp-" + randomToken().slice(0, 24) }
  );
  if (r.error) return fail(r.error, "Connect your music service first.", 401);
  await notify(r);
  return json({ id: r.id, code: r.code });
});

/** Rename, change permissions, regenerate the private link, or extend. */
export const PATCH = handle(async (req: Request) => {
  sameOrigin(req);
  const h = await currentHost();
  if (!h) return fail("not_connected", "Not signed in as a driver.", 401);
  const b = await body<{ sessionId: string; name?: string; permissions?: Record<string, unknown>; regenerate?: boolean; extend?: boolean }>(req);
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (b.permissions && typeof b.permissions === "object") {
    const p = b.permissions;
    const clean: Record<string, unknown> = {};
    for (const k of ["allowAdd", "allowPlayback", "allowSkip"]) if (typeof p[k] === "boolean") clean[k] = p[k];
    if (typeof p.maxPerPerson === "number") clean.maxPerPerson = Math.max(0, Math.min(20, Math.round(p.maxPerPerson)));
    patch.permissions = clean;
  }
  if (b.regenerate) patch.code = randomCode(8);
  if (b.extend) patch.extend = true;
  const r = await rpc<{ error?: string; channel: string; version: number }>("rp_session_update", {
    p_host: h.id, p_session: b.sessionId, p_patch: patch,
  });
  if (r.error) return fail(r.error, "This session is no longer active.", 404);
  await notify(r);
  return json({ ok: true, code: patch.code || null });
});

/** End the session for everyone. */
export const DELETE = handle(async (req: Request) => {
  sameOrigin(req);
  const h = await currentHost();
  if (!h) return fail("not_connected", "Not signed in as a driver.", 401);
  const { sessionId } = await body<{ sessionId: string }>(req);
  const r = await rpc<{ error?: string; channel: string; version: number }>("rp_session_update", {
    p_host: h.id, p_session: sessionId, p_patch: { end: true },
  });
  if (r.error && r.error !== "ended") return fail(r.error, "Session not found.", 404);
  await notify(r);
  return json({ ok: true });
});
