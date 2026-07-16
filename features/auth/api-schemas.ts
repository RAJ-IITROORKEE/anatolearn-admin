import { z } from "zod";

import { emailSchema, loginSchema, passwordSchema } from "@/features/auth/schemas";

export { emailSchema, loginSchema, passwordSchema };

export const registerSchema = loginSchema.extend({
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(100),
});
export const verifySignupOtpSchema = z.object({
  email: emailSchema.shape.email,
  otp: z.string().regex(/^\d{6}$/),
}).strict();
export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  avatarUrl: z.url().nullable().optional(),
}).strict();
export { deviceTokenSchema } from "@/features/notifications/schemas";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  message: "New password must differ from the current password.",
  path: ["newPassword"],
});

export const resetPasswordSchema = z.object({
  accessToken: z.string().min(1),
  password: z.string().min(12).max(128),
}).strict();
