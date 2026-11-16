import { handle, json } from "@/lib/api";
import { AppError } from "@/lib/db";
import { buildState, loadContext } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Everything a screen needs. Driver and passengers get role-appropriate views. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const probe = new URL(req.url).searchParams.has("probe");
  try {
    const ctx = await loadContext(id);
    return json(await buildState(ctx));
  } catch (e) {
    if (e instanceof AppError && e.code === "ended") return json({ ended: true, reason: e.message });
    // The join screen asks "am I already in?" — answer without an error status.
    if (probe && e instanceof AppError && (e.code === "not_member" || e.code === "removed")) return json({ member: false });
    throw e;
  }
});
