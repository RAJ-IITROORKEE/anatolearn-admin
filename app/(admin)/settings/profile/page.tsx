import { PageHeader } from "@/components/app-shell/page-header";
import { requireAdminPage } from "@/lib/auth/session";

export default async function ProfileSettingsPage() {
  const { profile } = await requireAdminPage();
  return (
    <div>
      <PageHeader title="Profile settings" description="Review the application profile linked to your authenticated account." />
      <dl className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <div><dt className="text-sm font-semibold text-muted">Name</dt><dd className="mt-1 text-foreground">{profile.fullName}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Email</dt><dd className="mt-1 text-foreground">{profile.email}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Role</dt><dd className="mt-1 text-foreground">Administrator</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Status</dt><dd className="mt-1 text-success">Active</dd></div>
      </dl>
    </div>
  );
}
