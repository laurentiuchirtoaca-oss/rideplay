import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

function db() {
  if (!client) {
    const url = env.supabaseUrl();
    const key = env.supabaseSecret();
    if (!url || !key) throw new AppError("not_configured", "The database is not configured yet.", 503);
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

/** Calls one of the rp_* database functions. Every function returns JSON. */
export async function rpc<T = Record<string, unknown>>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) {
    console.error(`[db] ${fn} failed`, error);
    throw new AppError("db_error", "The server could not reach the database. Try again.", 503);
  }
  return data as T;
}

/**
 * Tells every open screen of a session that something changed.
 * The message carries no data — screens fetch the new state through the
 * authenticated API, so the realtime channel itself reveals nothing.
 */
export async function broadcast(channel?: string | null, version?: number | null) {
  if (!channel || !env.supabasePublishable()) return;
  try {
    const ch = db().channel(channel);
    await ch.httpSend("sync", { v: version ?? 0 });
    db().removeChannel(ch);
  } catch (e) {
    console.warn("[realtime] broadcast failed", (e as Error).message);
  }
}

type Bumped = { channel?: string; version?: number; ended?: { channel: string; version: number }[] };

/** Broadcast for any rpc result that carries a version bump. */
export async function notify(result: Bumped | null | undefined) {
  if (!result) return;
  const tasks = [broadcast(result.channel, result.version)];
  for (const e of result.ended || []) tasks.push(broadcast(e.channel, e.version));
  await Promise.all(tasks);
}
