export type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type AuthAdminPort = {
  listUsers(input: { page: number; perPage: number }): Promise<{ users: AuthUser[] }>;
  createUser(input: { email: string; password: string; emailConfirm: true }): Promise<{ user: AuthUser }>;
  deleteUser(id: string): Promise<void>;
};

type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  emailNormalized: string;
  role: "ADMIN";
  isActive: true;
};

export type ProfileStore = {
  upsertAdmin(profile: AdminProfile): Promise<void>;
};

export class BootstrapError extends Error {
  constructor(readonly code: "BOOTSTRAP_COMPENSATION_FAILED") {
    super(
      "BOOTSTRAP_COMPENSATION_FAILED: Profile persistence failed and the newly created Auth user could not be removed. Remove the newly created Auth user before retrying.",
    );
    this.name = "BootstrapError";
  }
}

type BootstrapInput = {
  email: string;
  password?: string;
  auth: AuthAdminPort;
  profiles: ProfileStore;
};

async function findAuthUser(auth: AuthAdminPort, normalizedEmail: string): Promise<AuthUser | null> {
  for (let page = 1; page <= 100; page += 1) {
    let users: AuthUser[];
    try {
      ({ users } = await auth.listUsers({ page, perPage: 100 }));
    } catch {
      throw new Error("Unable to query Supabase Auth users.");
    }
    const match = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) return match;
    if (users.length < 100) return null;
  }
  return null;
}

export async function bootstrapAdmin({ email, password, auth, profiles }: BootstrapInput) {
  const normalizedEmail = email.trim().toLowerCase();
  let authUser = await findAuthUser(auth, normalizedEmail);
  let createdAuthUser = false;

  if (!authUser) {
    if (!password || password.length < 12) {
      throw new Error("A bootstrap password of at least 12 characters is required to create an Auth user.");
    }
    try {
      ({ user: authUser } = await auth.createUser({ email: normalizedEmail, password, emailConfirm: true }));
    } catch {
      throw new Error("Unable to create the Supabase Auth user.");
    }
    if (!authUser?.id) throw new Error("Unable to create the Supabase Auth user.");
    createdAuthUser = true;
  }

  const metadataName = authUser.user_metadata?.full_name;
  try {
    await profiles.upsertAdmin({
      id: authUser.id,
      fullName: typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : "Administrator",
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      role: "ADMIN",
      isActive: true,
    });
  } catch {
    if (createdAuthUser) {
      try {
        await auth.deleteUser(authUser.id);
      } catch {
        throw new BootstrapError("BOOTSTRAP_COMPENSATION_FAILED");
      }
    }
    throw new Error("Unable to persist the administrator profile.");
  }

  return { createdAuthUser };
}

type CliDependencies = {
  execute(): Promise<{ createdAuthUser: boolean }>;
  disconnect(): Promise<void>;
  logger: { info(message: string): void; error(message: string): void };
};

export async function runBootstrapAdminCli({ execute, disconnect, logger }: CliDependencies): Promise<0 | 1> {
  try {
    await execute();
    logger.info("Bootstrap complete: an active administrator profile is linked to Supabase Auth.");
    return 0;
  } catch (error) {
    logger.error(
      error instanceof BootstrapError
        ? error.message
        : "Administrator bootstrap failed. Review the configuration and provider availability.",
    );
    return 1;
  } finally {
    await disconnect();
  }
}
