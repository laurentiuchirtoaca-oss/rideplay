import { handle, json, sameOrigin } from "@/lib/api";
import { notify, rpc } from "@/lib/db";
import { clearPassengerToken, getPassengerToken, hashToken } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Passenger leaves the session. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  sameOrigin(req);
  const { id } = await params;
  const t = await getPassengerToken(id);
  if (t) {
    const r = await rpc<{ error?: string; channel: string; version: number }>("rp_leave", { p_session: id, p_token_hash: hashToken(t) });
    if (!r.error) await notify(r);
  }
  await clearPassengerToken(id);
  return json({ ok: true });
});
