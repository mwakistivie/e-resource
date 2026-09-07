import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soma Resources — Educational materials for Kenyan classrooms",
  description: "Buy schemes of work, notes, past papers and more. Pay with M-Pesa, download instantly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const betaFreeMode = process.env.BETA_FREE_MODE === "true";
  return (
    <html lang="en">
      <body className="font-body min-h-screen flex flex-col">
        {betaFreeMode && (
          <div className="bg-clay text-white text-sm text-center py-2 px-4">
            🎉 Beta testing — all resources are free right now, no M-Pesa payment required.
          </div>
        )}
        <header className="border-b border-sand bg-paper sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-display text-2xl font-semibold text-ink">
              Soma<span className="text-clay">.</span>
            </Link>
            <nav className="text-sm text-ink/70">
              <Link href="/" className="hover:text-ink">Browse resources</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-sand mt-16">
          <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-ink/60 flex flex-wrap gap-x-6 gap-y-2">
            <span>© {new Date().getFullYear()} Soma Resources</span>
            <Link href="/orders/lookup" className="hover:text-ink">Lost your download link?</Link>
            <Link href="/admin/login" className="hover:text-ink">Admin</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
