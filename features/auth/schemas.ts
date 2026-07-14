import { z } from "zod";

const email = z.string().trim().toLowerCase().email();

export const loginSchema = z.object({
  email,
  password: z.string().min(8).max(128),
}).strict();

export const emailSchema = z.object({ email }).strict();

export const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function safeNextPath(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
