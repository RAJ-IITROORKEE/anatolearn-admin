import { logError } from "@/lib/logger";

type AuthUser = { id: string; identities?: unknown[] | null };
type DeleteUser = (userId: string) => Promise<{ error: unknown }>;

export class RegistrationRetryError extends Error {
  readonly code = "REGISTRATION_RETRY";
  constructor() { super("Registration could not be completed. Please try again."); }
}

export async function provisionRegisteredUser<T extends AuthUser>(
  user: T,
  fullName: string,
  provision: (user: T, fullName: string) => Promise<unknown>,
  deleteUser: DeleteUser,
  requestId = crypto.randomUUID(),
) {
  if (Array.isArray(user.identities) && user.identities.length === 0) {
    return { provisioned: false as const };
  }
  try {
    return { provisioned: true as const, profile: await provision(user, fullName) };
  } catch {
    if (Array.isArray(user.identities) && user.identities.length > 0) {
      try {
        const result = await deleteUser(user.id);
        if (result.error) throw new Error("Compensation rejected.");
      } catch {
        logError({ requestId, code: "REGISTRATION_COMPENSATION_FAILED", status: 500, route: "/api/v1/auth/register" });
      }
    }
    throw new RegistrationRetryError();
  }
}
