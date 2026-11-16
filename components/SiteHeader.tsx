import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link href="/" aria-label="RIDEPLAY home" className="rounded-lg">
        <Logo />
      </Link>
      {right}
    </header>
  );
}
