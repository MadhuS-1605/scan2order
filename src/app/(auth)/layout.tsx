import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-grain">
      <header className="mx-auto w-full max-w-5xl px-6 py-6">
        <Link href="/" className="font-display text-xl font-medium text-ink">
          Scan&nbsp;to&nbsp;Order
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
