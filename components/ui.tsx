"use client";

import { forwardRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";

import { cx } from "@/lib/cx";
export { cx };

/* ---------------- Button ---------------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition",
        "active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100",
        size === "sm" && "h-9 rounded-[10px] px-3 text-[13px]",
        size === "md" && "h-11 rounded-xl px-4 text-[15px]",
        size === "lg" && "h-14 rounded-2xl px-6 text-base",
        variant === "primary" && "bg-accent text-on-accent hover:brightness-105 shadow-[0_8px_24px_-12px_var(--accent)]",
        variant === "secondary" && "bg-card-2 text-fg hover:bg-line",
        variant === "outline" && "border border-line text-fg hover:bg-card-2",
        variant === "ghost" && "text-muted hover:bg-card-2 hover:text-fg",
        variant === "danger" && "bg-danger/12 text-danger hover:bg-danger/20",
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-35",
        active ? "bg-accent text-on-accent" : "text-muted hover:bg-card-2 hover:text-fg",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-[20px] border border-line bg-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, id }: { children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Badge({ tone = "default", children, className }: { tone?: "default" | "accent" | "warn" | "danger"; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "default" && "bg-card-2 text-muted",
        tone === "accent" && "bg-accent/12 text-accent-ink",
        tone === "warn" && "bg-warn/12 text-warn",
        tone === "danger" && "bg-danger/12 text-danger",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg", className)} />;
}

/* ---------------- Switch ---------------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cx("flex cursor-pointer items-start justify-between gap-4 py-3", disabled && "opacity-50")}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
          checked ? "bg-accent" : "bg-line"
        )}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 rounded-full shadow transition-transform",
            checked ? "translate-x-6 bg-on-accent" : "translate-x-1 bg-fg"
          )}
        />
      </button>
    </label>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-1 overflow-x-auto", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition",
            value === o.value ? "bg-fg text-bg" : "bg-card-2 text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Sheet (bottom on mobile, centered on desktop) ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cx(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line bg-bg-2 shadow-soft sm:rounded-[24px]",
              wide ? "sm:max-w-2xl" : "sm:max-w-md"
            )}
            initial={{ y: 40, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 className="truncate text-base font-semibold">{title}</h2>
              <IconButton label="Close" onClick={onClose} className="-mr-2">
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Empty / message states ---------------- */

export function Empty({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-2 text-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-xs text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
