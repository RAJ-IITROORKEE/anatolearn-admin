import type { Metadata } from "next";
import Link from "next/link";
import { HeartPulse } from "lucide-react";

export const metadata: Metadata = {
  title: {
    default: "AnatoLearn",
    template: "%s | AnatoLearn",
  },
};

const navLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/login", label: "Log in" },
] as const;

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3" aria-label="AnatoLearn">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm">
              <HeartPulse aria-hidden="true" className="size-5" strokeWidth={2.25} />
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight">AnatoLearn</span>
              <span className="block text-xs font-medium text-muted">Educational anatomy service</span>
            </span>
          </div>
          <nav aria-label="Legal and account navigation">
            <ul className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-body hover:bg-primary-soft hover:text-primary"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8" id="main-content">
        {children}
      </main>
      <footer className="border-t border-border bg-surface">
        <p className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-muted sm:px-6 lg:px-8">
          AnatoLearn educational anatomy service.
        </p>
      </footer>
    </div>
  );
}
