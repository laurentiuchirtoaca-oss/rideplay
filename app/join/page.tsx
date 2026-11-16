import type { Metadata } from "next";
import { CodeEntry } from "@/components/JoinFlow";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Join a session" };

export default function JoinPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col px-4 pb-16 pt-8 sm:px-6">
        <h1 className="mb-2 text-4xl font-semibold tracking-[-0.035em]">Join a ride</h1>
        <p className="mb-8 text-muted">Scan the driver&apos;s QR code with your camera, or type the code.</p>
        <CodeEntry />
      </main>
    </>
  );
}
