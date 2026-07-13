import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { updatePasswordAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Use at least 12 characters. This page requires a valid Supabase recovery session.</p>
      <AuthForm action={updatePasswordAction} fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password" }, { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" }]} submitLabel="Update password" />
    </div>
  );
}
