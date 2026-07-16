import { AppShell } from "@/components/app-shell/app-shell";
import { requireAdminPage } from "@/lib/auth/session";
import { Toaster } from "sonner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdminPage();
  return <><AppShell profile={{ fullName: profile.fullName, email: profile.email }}>{children}</AppShell><Toaster closeButton position="top-right" richColors /></>;
}
