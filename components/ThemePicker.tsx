"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { getTheme, setTheme } from "@/lib/client";
import { cx } from "./ui";

export default function ThemePicker() {
  const [t, setT] = useState<"dark" | "light" | "system">("dark");
  useEffect(() => setT(getTheme()), []);
  const opts = [
    { v: "dark" as const, label: "Dark", icon: Moon },
    { v: "light" as const, label: "Light", icon: Sun },
    { v: "system" as const, label: "Auto", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={t === o.v}
          onClick={() => {
            setTheme(o.v);
            setT(o.v);
          }}
          className={cx(
            "flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition",
            t === o.v ? "border-accent bg-accent/[0.07] text-fg" : "border-line text-muted hover:text-fg"
          )}
        >
          <o.icon className="h-5 w-5" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
