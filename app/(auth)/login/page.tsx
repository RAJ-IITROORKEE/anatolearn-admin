import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const reason = (await searchParams).reason;
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Sign in to manage AnatoLearn content and operations.</p>
      {reason === "admin-required" ? <p className="mt-5 rounded-xl bg-warning-soft p-3 text-sm text-warning" role="alert">An active administrator profile is required.</p> : null}
      <AuthForm action={loginAction} fields={[{ name: "email", label: "Email address", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} submitLabel="Sign in" />
      <Link className="mt-5 block text-center text-sm font-semibold text-primary hover:text-primary-hover" href="/forgot-password">Forgot password?</Link>
    </div>
  );
}
