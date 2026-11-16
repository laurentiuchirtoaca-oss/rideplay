import type { Metadata } from "next";
import PassengerApp from "@/components/PassengerApp";

export const metadata: Metadata = { title: "Session", robots: { index: false } };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PassengerApp sessionId={id} />;
}
