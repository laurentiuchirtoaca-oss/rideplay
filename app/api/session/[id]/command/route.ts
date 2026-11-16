import { fail, handle, json } from "@/lib/api";
import { rpc } from "@/lib/db";
import { loadContext } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Apple Music: did the driver's player carry out my command? */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await loadContext(id);
  const cid = Number(new URL(req.url).searchParams.get("cid"));
  if (!Number.isFinite(cid)) return fail("bad_request", "Invalid command.");
  const r = await rpc<{ status: string; error: string | null } | null>("rp_command_status", { p_session: id, p_command: cid });
  return json(r || { status: "failed", error: "Unknown command" });
});
