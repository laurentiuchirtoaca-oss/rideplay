import { fail, handle, json } from "@/lib/api";
import { catalogFor, loadContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const KINDS = new Set(["album", "artist", "playlist", "mine"]);

/** Open an album, artist or playlist from the catalogue. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await loadContext(id);
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") || "";
  const itemId = (u.searchParams.get("id") || "").slice(0, 100);
  if (!KINDS.has(kind) || (kind !== "mine" && !/^[A-Za-z0-9.\-]+$/.test(itemId))) return fail("bad_request", "Invalid request.");
  return json(await catalogFor(ctx).browse(kind, itemId));
});
