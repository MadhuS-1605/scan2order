import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-grain">
      <header className="mx-auto w-full max-w-5xl px-6 py-6">
        <Link href="/" className="flex items-center">
          <Image src="/logo-mark.png" alt="Scan2Order" width={40} height={40} className="h-10 w-10" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
