import type { Metadata } from "next";

import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { getAdminDashboard } from "@/features/admin-dashboard/service";
import { parseAdminDashboardQuery } from "@/features/admin-dashboard/schemas";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const input = parseAdminDashboardQuery(query);
  const data = await getAdminDashboard(input);
  return <AdminDashboard data={data} />;
}
