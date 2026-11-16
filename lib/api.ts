import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./db";
import { ProviderError } from "./providers/spotify";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

export const fail = (code: string, error: string, status = 400) => json({ error, code }, status);

/** Wraps a route handler: consistent JSON errors, never leaks internals. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) return fail(e.code, e.message, e.status);
      if (e instanceof ProviderError) return fail(e.code || "provider", e.message, e.status);
      console.error("[api] unexpected", e);
      return fail("server", "Something went wrong on the server. Try again.", 500);
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("bad_request", "Invalid request.", 400);
  }
}

/** Rejects cross-site POSTs (CSRF) — all writes must come from our own pages. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new AppError("forbidden", "Request blocked.", 403);
}
