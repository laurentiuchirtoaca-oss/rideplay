import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { dispatchItem, loadContext, requireHost } from "@/lib/session";
import type { QueueItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Driver removes a song from the shared queue. */
export const DELETE = handle(async (req: Request) => {
  sameOrigin(req);
  const { sessionId, itemId } = await body<{ sessionId: string; itemId: string }>(req);
  const ctx = await loadContext(sessionId);
  requireHost(ctx);
  const r = await rpc<{ error?: string; wasSent?: boolean; channel: string; version: number }>("rp_queue_remove", {
    p_host: ctx.host.id, p_session: sessionId, p_item: itemId,
  });
  if (r.error) return fail(r.error, "That song is no longer in the queue.", 404);
  await notify(r);
  return json({ ok: true, wasSent: !!r.wasSent });
});

/** Retry sending a song that the provider rejected. */
export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  const { sessionId, itemId } = await body<{ sessionId: string; itemId: string }>(req);
  const ctx = await loadContext(sessionId);
  const item = await rpc<QueueItem | null>("rp_queue_get", { p_session: sessionId, p_item: itemId });
  if (!item || item.status !== "queued") return fail("not_found", "That song is no longer in the queue.", 404);
  if (ctx.actor.kind !== "host" && item.addedBy !== ctx.actor.id)
    return fail("forbidden", "Only the driver or the person who added it can retry.", 403);
  const r = await dispatchItem(ctx, item);
  return r.ok ? json({ ok: true }) : fail("provider", r.error || "Couldn't send the song.", 409);
});
