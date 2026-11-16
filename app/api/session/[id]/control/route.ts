import { body, fail, handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { caps, loadContext, refreshPlayback, spotifyFor } from "@/lib/session";
import { ProviderError } from "@/lib/providers/spotify";

export const dynamic = "force-dynamic";

type Action = "play" | "pause" | "next" | "previous" | "playContext";

/**
 * Playback commands go to the driver's player. A command is reported as done
 * only when the music service accepted it — never optimistically.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  sameOrigin(req);
  const { id } = await params;
  const ctx = await loadContext(id);
  const { action, uri } = await body<{ action: Action; uri?: string }>(req);
  const c = caps(ctx);

  if (action === "play" || action === "pause" || action === "playContext") {
    if (!c.playback) return fail("forbidden", "The driver hasn't allowed you to control playback.", 403);
  } else if (action === "next" || action === "previous") {
    if (!c.skip) return fail("forbidden", "The driver hasn't allowed you to skip songs.", 403);
  } else return fail("bad_request", "Unknown command.");

  if (ctx.session.provider === "spotify") {
    const sp = spotifyFor(ctx);
    if (action === "playContext") {
      if (!uri || !/^spotify:(playlist|album):[A-Za-z0-9]+$/.test(uri)) return fail("bad_request", "Invalid playlist.");
      await sp.playContext(uri);
    } else await sp.control(action);
    // Give Spotify a moment, then read back the real state.
    await new Promise((r) => setTimeout(r, 450));
    const playback = await refreshPlayback(ctx, true);
    return json({ ok: true, playback });
  }

  // Apple Music: the driver's RIDEPLAY tab is the player and executes the command.
  const pb = await refreshPlayback(ctx);
  if (pb.error === "player_offline")
    throw new ProviderError("player_offline", "The driver's RIDEPLAY player isn't open right now.", 409);
  let payload: Record<string, string> = {};
  if (action === "playContext") {
    const m = /^apple:(playlist|album):([A-Za-z0-9.\-]+)$/.exec(uri || "");
    if (!m) return fail("bad_request", "Invalid playlist.");
    payload = { type: m[1], id: m[2] };
  }
  const r = await rpc<{ commandId: number; channel: string; version: number }>("rp_command_add", {
    p_session: id, p_kind: action, p_payload: payload,
  });
  await notify(r);
  return json({ ok: true, pending: true, commandId: r.commandId }, 202);
});
