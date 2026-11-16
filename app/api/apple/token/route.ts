import { fail, handle, json } from "@/lib/api";
import { configured } from "@/lib/env";
import { developerToken } from "@/lib/providers/apple";
import { requestOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * MusicKit on the Web needs a developer token in the browser. Apple designs
 * it to be public; it is locked to this site's origin and expires in 12 h.
 */
export const GET = handle(async () => {
  if (!configured.apple()) return fail("not_configured", "Apple Music isn't set up on this server.", 503);
  return json({ token: developerToken(await requestOrigin()) });
});
