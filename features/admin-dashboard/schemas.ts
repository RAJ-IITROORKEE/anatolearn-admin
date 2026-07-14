import { z } from "zod";

export const adminDashboardQuerySchema = z.object({
  days: z.enum(["7", "30", "90"])
    .transform(Number)
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .default(30),
}).strict();

export function parseAdminDashboardQuery(searchParams: URLSearchParams) {
  const input: Record<string, unknown> = Object.fromEntries(searchParams);
  const days = searchParams.getAll("days");
  if (days.length > 1) input.days = days;
  return adminDashboardQuerySchema.parse(input);
}

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;
