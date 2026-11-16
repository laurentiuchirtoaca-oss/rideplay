import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { currentHost } from "@/lib/host";

export const dynamic = "force-dynamic";

/** Driver: allow/deny playback control for a passenger, or remove them. */
export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  const h = await currentHost();
  if (!h) return fail("not_connected", "Not signed in as a driver.", 401);
  const b = await body<{ sessionId: string; participantId: string; canControl?: boolean; remove?: boolean }>(req);
  const patch: Record<string, boolean> = {};
  if (typeof b.canControl === "boolean") patch.canControl = b.canControl;
  if (b.remove) patch.remove = true;
  const r = await rpc<{ error?: string; channel: string; version: number }>("rp_participant_update", {
    p_host: h.id, p_session: b.sessionId, p_participant: b.participantId, p_patch: patch,
  });
  if (r.error) return fail(r.error, "Session not found.", 404);
  await notify(r);
  return json({ ok: true });
});
