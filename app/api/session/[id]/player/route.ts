import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { loadContext, requireHost } from "@/lib/session";
import type { Playback } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Apple Music only: the driver's RIDEPLAY tab (the actual player) reports what
 * is playing and the outcome of the commands it executed.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  sameOrigin(req);
  const { id } = await params;
  const ctx = await loadContext(id);
  requireHost(ctx);
  if (ctx.session.provider !== "apple") return fail("bad_request", "Not an Apple Music session.");
  const b = await body<{ playback?: Playback; results?: { id: number; ok: boolean; error?: string }[] }>(req);

  for (const r of (b.results || []).slice(0, 20)) {
    await notify(await rpc("rp_command_result", {
      p_session: id, p_command: Number(r.id), p_ok: !!r.ok, p_error: r.ok ? null : String(r.error || "Failed").slice(0, 200),
    }));
  }
  if (b.playback) {
    const pb: Playback = {
      track: b.playback.track || null,
      isPlaying: !!b.playback.isPlaying,
      progressMs: Math.max(0, Number(b.playback.progressMs) || 0),
      device: { name: "Driver's RIDEPLAY player", type: "Smartphone" },
      error: null,
    };
    const saved = await rpc<{ changed: boolean; skip: boolean; channel: string; version: number }>("rp_playback_save", {
      p_session: id, p_playback: pb, p_player_seen: true,
    });
    if (saved.changed) await notify(saved);
    return json({ ok: true, skip: saved.skip });
  }
  return json({ ok: true, skip: false });
});
