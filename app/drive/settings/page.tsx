import type { Metadata } from "next";
import DriverSettings from "@/components/DriverSettings";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <>
      <SiteHeader />
      <main className="pt-4">
        <DriverSettings />
      </main>
    </>
  );
}
