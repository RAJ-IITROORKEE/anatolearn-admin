import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Enter your administrator email. The response will not reveal whether an account exists.</p>
      <AuthForm action={forgotPasswordAction} fields={[{ name: "email", label: "Email address", type: "email", autoComplete: "email" }]} submitLabel="Send reset instructions" />
      <Link className="mt-5 block text-center text-sm font-semibold text-primary hover:text-primary-hover" href="/login">Back to sign in</Link>
    </div>
  );
}
