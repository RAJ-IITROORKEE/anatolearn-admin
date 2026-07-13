type ProfileAccess = {
  role: "ADMIN" | "USER";
  isActive: boolean;
};

export function canAccessAdmin(profile: ProfileAccess | null | undefined) {
  return profile?.role === "ADMIN" && profile.isActive;
}
