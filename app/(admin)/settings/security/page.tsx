import { PageHeader } from "@/components/app-shell/page-header";
import { AuthForm } from "@/components/auth/auth-form";
import { changePasswordAction } from "@/features/auth/actions";

export default function SecuritySettingsPage() {
  return (
    <div>
      <PageHeader title="Security" description="Change the password for the current Supabase Auth account." />
      <div className="mt-6 max-w-xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <AuthForm action={changePasswordAction} fields={[{ name: "currentPassword", label: "Current password", type: "password", autoComplete: "current-password" }, { name: "password", label: "New password", type: "password", autoComplete: "new-password" }, { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" }]} submitLabel="Change password" />
      </div>
    </div>
  );
}
