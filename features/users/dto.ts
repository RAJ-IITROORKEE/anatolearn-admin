type SafeProfile = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function adminUserListItemDto(value: SafeProfile) {
  return {
    id: value.id,
    fullName: value.fullName,
    email: value.email,
    avatarUrl: value.avatarUrl,
    isActive: value.isActive,
    lastLoginAt: value.lastLoginAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function adminUserDetailDto(value: SafeProfile, activity: {
  attempts: number;
  submittedAttempts: number;
  feedback: number;
  lastAttemptAt: Date | null;
}) {
  return { ...adminUserListItemDto(value), activity };
}
