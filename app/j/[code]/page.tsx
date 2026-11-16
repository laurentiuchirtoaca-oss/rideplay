import type { Metadata } from "next";
import { JoinScreen } from "@/components/JoinFlow";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Join session", robots: { index: false } };

export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col px-4 pb-16 pt-6 sm:px-6">
        <JoinScreen code={code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)} />
      </main>
    </>
  );
}
