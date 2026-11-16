import "server-only";
import { configured } from "./env";
import { rpc } from "./db";
import { getHostToken, hashToken } from "./security";

export type HostInfo = {
  id: string;
  provider: "spotify" | "apple";
  displayName: string;
  settings: Record<string, string>;
  session: { id: string; name: string; code: string } | null;
  secrets: string | null;
};

/** The driver behind the current browser, if any. */
export async function currentHost(): Promise<HostInfo | null> {
  const t = await getHostToken();
  if (!t || !configured.database()) return null;
  return rpc("rp_host_get", { p_token_hash: hashToken(t) });
}
