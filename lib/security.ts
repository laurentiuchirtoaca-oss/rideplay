import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { env } from "./env";

/* ---------- random identifiers ---------- */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

export function randomCode(len = 8) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const randomToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/* ---------- encryption for provider tokens at rest ---------- */

function key() {
  const s = env.sessionSecret();
  if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return createHash("sha256").update("rideplay:" + s).digest();
}

export function encrypt(data: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt<T>(blob: string | null | undefined): T | null {
  if (!blob) return null;
  try {
    const [iv, tag, body] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

/* ---------- cookies ---------- */

const secure = process.env.NODE_ENV === "production";
const HOST_COOKIE = "rp_host";
const passengerCookie = (sessionId: string) => `rp_p_${sessionId.replace(/-/g, "").slice(0, 12)}`;

export async function getHostToken() {
  return (await cookies()).get(HOST_COOKIE)?.value || null;
}
export async function setHostToken(token: string) {
  (await cookies()).set(HOST_COOKIE, token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
export async function clearHostToken() {
  (await cookies()).delete(HOST_COOKIE);
}

export async function getPassengerToken(sessionId: string) {
  return (await cookies()).get(passengerCookie(sessionId))?.value || null;
}
export async function setPassengerToken(sessionId: string, token: string) {
  (await cookies()).set(passengerCookie(sessionId), token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
  });
}
export async function clearPassengerToken(sessionId: string) {
  (await cookies()).delete(passengerCookie(sessionId));
}

/** Short-lived cookie used to protect the OAuth round trip. */
export async function setFlowCookie(name: string, value: string) {
  (await cookies()).set(name, value, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
}
export async function takeFlowCookie(name: string) {
  const jar = await cookies();
  const v = jar.get(name)?.value || null;
  jar.delete(name);
  return v;
}

/* ---------- request helpers ---------- */

export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

const buckets = new Map<string, { n: number; reset: number }>();
/** Small in-memory limiter against bursts (per server instance). */
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  return ++b.n <= max;
}
