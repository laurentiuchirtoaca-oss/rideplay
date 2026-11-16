"use client";

import { useCallback } from "react";
import { useToast } from "@/components/toast";
import { api, ApiFail } from "./client";
import type { ControlAction } from "@/components/NowPlaying";
import type { QueueItem, SessionState, Track } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Session actions shared by the driver and passenger screens.
 * Success is only reported after the server (and the music service) confirm.
 */
export function useActions(state: SessionState | null, refresh: () => Promise<void>) {
  const toast = useToast();
  const sid = state?.session.id;

  const errorToast = useCallback(
    (e: unknown, fallback: string) => toast({ tone: "error", text: e instanceof ApiFail ? e.message : fallback }),
    [toast]
  );

  /** Apple Music: wait for the driver's player to carry out the command. */
  const awaitCommand = useCallback(
    async (cid: number) => {
      for (let i = 0; i < 16; i++) {
        await wait(500);
        const r = await api<{ status: string; error: string | null }>(`/api/session/${sid}/command?cid=${cid}`);
        if (r.status === "done") return true;
        if (r.status === "failed") throw new ApiFail("player", r.error || "The driver's player couldn't do that.", 409);
      }
      throw new ApiFail("timeout", "The driver's player didn't respond. Make sure RIDEPLAY is open on the driver's phone.", 408);
    },
    [sid]
  );

  const add = useCallback(
    async (t: Track): Promise<boolean> => {
      try {
        const r = await api<{ sent?: boolean; pending?: boolean; error?: string }>(`/api/session/${sid}/queue`, {
          method: "POST",
          json: { track: t },
        });
        refresh();
        if (r.error) {
          toast({ tone: "error", text: `Added to the RIDEPLAY queue, but not sent: ${r.error}` });
          return true;
        }
        toast({
          tone: "success",
          art: t.artwork,
          text: r.pending ? `${t.title} added — the driver's player will queue it` : `${t.title} added to the queue`,
        });
        return true;
      } catch (e) {
        errorToast(e, "Couldn't add the song.");
        return false;
      }
    },
    [sid, refresh, toast, errorToast]
  );

  const control = useCallback(
    async (action: ControlAction | "playContext", uri?: string) => {
      try {
        const r = await api<{ pending?: boolean; commandId?: number }>(`/api/session/${sid}/control`, {
          method: "POST",
          json: { action, uri },
        });
        if (r.pending && r.commandId) await awaitCommand(r.commandId);
        await refresh();
        return true;
      } catch (e) {
        errorToast(e, "The command didn't go through.");
        refresh();
        return false;
      }
    },
    [sid, refresh, awaitCommand, errorToast]
  );

  const playContext = useCallback(
    async (uri: string, name: string) => {
      if (await control("playContext", uri)) toast({ tone: "success", text: `Playing ${name}` });
    },
    [control, toast]
  );

  const remove = useCallback(
    async (item: QueueItem) => {
      try {
        const r = await api<{ wasSent: boolean }>("/api/host/queue", { method: "DELETE", json: { sessionId: sid, itemId: item.id } });
        toast({
          tone: "info",
          text: r.wasSent
            ? `${item.title} removed. It was already in the music app's queue, so RIDEPLAY will skip it when it comes up.`
            : `${item.title} removed`,
        });
        refresh();
      } catch (e) {
        errorToast(e, "Couldn't remove the song.");
      }
    },
    [sid, refresh, toast, errorToast]
  );

  const retry = useCallback(
    async (item: QueueItem) => {
      try {
        await api("/api/host/queue", { method: "POST", json: { sessionId: sid, itemId: item.id } });
        toast({ tone: "success", text: `${item.title} sent` });
      } catch (e) {
        errorToast(e, "Still couldn't send it.");
      }
      refresh();
    },
    [sid, refresh, toast, errorToast]
  );

  return { add, control: (a: ControlAction) => control(a).then(() => undefined), playContext, remove, retry };
}
