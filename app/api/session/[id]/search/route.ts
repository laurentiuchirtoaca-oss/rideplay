import { fail, handle, json } from "@/lib/api";
import { catalogFor, loadContext } from "@/lib/session";
import { limit } from "@/lib/security";

export const dynamic = "force-dynamic";

const TYPES = new Set(["all", "track", "artist", "album", "playlist"]);

/** Search the session's music catalogue (through the driver's provider). */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await loadContext(id);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 100);
  const type = u.searchParams.get("type") || "all";
  const offset = Math.max(0, Math.min(200, Number(u.searchParams.get("offset")) || 0));
  if (!q) return json({ tracks: [], artists: [], albums: [], playlists: [] });
  if (!TYPES.has(type)) return fail("bad_request", "Unknown filter.");
  if (!limit(`search:${id}:${ctx.actor.id || "host"}`, 40, 60_000))
    return fail("too_fast", "Searching too fast — wait a few seconds.", 429);
  return json(await catalogFor(ctx).search(q, type, offset));
});
