import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Onboarding from "@/components/Onboarding";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Start a session" };

export default function StartPage() {
  return (
    <>
      <SiteHeader right={<Link href="/join" className="text-sm font-medium text-muted hover:text-fg">Join instead</Link>} />
      <main className="pt-6">
        <Suspense>
          <Onboarding />
        </Suspense>
      </main>
    </>
  );
}
