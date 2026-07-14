import { describe, expect, it, vi } from "vitest";

import { provisionRegisteredUser } from "./registration";

describe("registration compensation", () => {
  it("deletes a newly-created auth user when profile provisioning fails", async () => {
    const provision = vi.fn().mockRejectedValue(new Error("database secret"));
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    await expect(provisionRegisteredUser({ id: "new-user", identities: [{ id: "identity" }] }, "New User", provision, deleteUser))
      .rejects.toMatchObject({ code: "REGISTRATION_RETRY" });
    expect(deleteUser).toHaveBeenCalledWith("new-user");
  });

  it("never deletes an auth user that Supabase did not identify as newly created", async () => {
    const provision = vi.fn();
    const deleteUser = vi.fn();
    await expect(provisionRegisteredUser({ id: "obfuscated-user", identities: [] }, "Existing", provision, deleteUser))
      .resolves.toEqual({ provisioned: false });
    expect(provision).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
