"use client";

import type { ProviderId } from "./types";

export class ApiFail extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

/** JSON fetch with readable errors. Never treats a failed response as success. */
export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers || {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiFail("network", "No connection. Check your internet and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) throw new ApiFail(data.code || "error", data.error || "Something went wrong.", res.status);
  return data as T;
}

export const providerName = (p: ProviderId) => (p === "spotify" ? "Spotify" : "Apple Music");

export function formatMs(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "–:––";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function getTheme(): "dark" | "light" | "system" {
  try {
    const t = localStorage.getItem("rp-theme");
    return t === "light" || t === "system" ? t : "dark";
  } catch {
    return "dark";
  }
}

export function setTheme(t: "dark" | "light" | "system") {
  try {
    localStorage.setItem("rp-theme", t);
  } catch {}
  const light = t === "light" || (t === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
}

import { useEffect, useState } from "react";

/** True when the media query matches (false during the first render). */
export function useMediaQuery(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    setM(mq.matches);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
