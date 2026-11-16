import type { Metadata } from "next";
import DriverApp from "@/components/DriverApp";

export const metadata: Metadata = { title: "Driver", robots: { index: false } };

export default function DrivePage() {
  return <DriverApp />;
}
