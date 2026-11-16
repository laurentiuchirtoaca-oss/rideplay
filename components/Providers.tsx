"use client";

import { MotionConfig } from "motion/react";
import { ToastProvider } from "./toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
