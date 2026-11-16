"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, Info } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string; art?: string | null };

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.tone === "error" ? 5200 : 2800);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3 text-sm shadow-soft"
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.art} alt="" className="h-9 w-9 rounded-md object-cover" />
              ) : (
                <span
                  className={
                    t.tone === "error"
                      ? "text-danger"
                      : t.tone === "success"
                        ? "text-accent-ink"
                        : "text-muted"
                  }
                >
                  {t.tone === "error" ? <AlertCircle className="h-5 w-5" /> : t.tone === "success" ? <Check className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                </span>
              )}
              <span className="leading-snug">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
