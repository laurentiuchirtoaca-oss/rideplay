import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { catalogFor, dispatchItem, loadContext } from "@/lib/session";
import { ProviderError } from "@/lib/providers/spotify";
import type { QueueItem, Track } from "@/lib/types";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, [string, number]> = {
  add_disabled: ["The driver has turned off adding songs for passengers.", 403],
  duplicate: ["That song is already in the queue.", 409],
  too_fast: ["Slow down a little — try again in a few seconds.", 429],
  limit_reached: ["You've reached the driver's limit of songs waiting in the queue.", 429],
  ended: ["This session has ended.", 410],
};

/** Add a song to the shared queue, then hand it to the music service. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  sameOrigin(req);
  const { id } = await params;
  const ctx = await loadContext(id);
  const { track: sent } = await body<{ track: Track }>(req);
  const songId = String(sent?.trackId || "");
  if (!/^[A-Za-z0-9.\-]{1,64}$/.test(songId)) return fail("bad_request", "Missing song details.");
  // Look the song up with the music service itself — titles and artwork are never taken from the browser.
  const track = await catalogFor(ctx)
    .track(songId)
    .catch((e) => {
      if (e instanceof ProviderError && e.code === "not_found") return null;
      throw e;
    });
  if (!track) return fail("not_found", "That song isn't available in this session's music service.", 404);

  const r = await rpc<{ error?: string; limit?: number; item: QueueItem; channel: string; version: number }>(
    "rp_queue_add",
    { p_session: id, p_actor: ctx.actor, p_item: track }
  );
  if (r.error) {
    const [msg, status] = ERRORS[r.error] || ["Couldn't add the song.", 400];
    return fail(r.error, msg, status);
  }
  await notify(r);
  const d = await dispatchItem(ctx, r.item);
  if (!d.ok) return json({ item: r.item, sent: false, error: d.error }, 202);
  return json({ item: r.item, sent: !d.pending, pending: !!d.pending });
});
