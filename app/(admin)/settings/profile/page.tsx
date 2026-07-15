import { PageHeader } from "@/components/app-shell/page-header";
import { AuthForm } from "@/components/auth/auth-form";
import { updateEmailAction } from "@/features/auth/actions";
import { requireAdminPage } from "@/lib/auth/session";

export default async function ProfileSettingsPage() {
  const { profile } = await requireAdminPage();
  return (
    <div>
      <PageHeader title="Profile settings" description="Manage the profile linked to your authenticated administrator account." />
      <dl className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <div><dt className="text-sm font-semibold text-muted">Name</dt><dd className="mt-1 text-foreground">{profile.fullName}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Email</dt><dd className="mt-1 text-foreground">{profile.email}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Role</dt><dd className="mt-1 text-foreground">Administrator</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Status</dt><dd className="mt-1 text-success">Active</dd></div>
      </dl>
      <section className="mt-6 max-w-xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Change email address</h2>
        <p className="mt-1 text-sm text-muted">A confirmation link will be sent before the new address becomes active.</p>
        <AuthForm action={updateEmailAction} fields={[{ name: "email", label: "New email address", type: "email", autoComplete: "email" }]} submitLabel="Change email" />
      </section>
    </div>
  );
}
