import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      <div aria-hidden="true" className="absolute -left-24 top-20 size-64 rounded-full bg-primary-soft blur-3xl" />
      <div aria-hidden="true" className="absolute -right-20 bottom-12 size-56 rounded-full bg-success-soft blur-3xl" />
      <section className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
        <BrandMark />
        {children}
        <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted">Admin access is restricted to authorized AnatoLearn staff. Authentication and session enforcement are connected in Phase 2.</p>
      </section>
    </main>
  );
}
