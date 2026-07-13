import { isSubmittedAttemptStatus } from "./domain";
import { attemptDetailDto, attemptListItemDto, attemptResultDto } from "./dto";

type Attempt = Parameters<typeof attemptDetailDto>[0] & {
  user: { id: string; fullName: string; email: string; isActive: boolean };
};

export function adminAttemptDetailDto(value: Attempt) {
  const attempt = isSubmittedAttemptStatus(value.status) ? attemptResultDto(value) : attemptDetailDto(value);
  return { ...attempt, user: value.user };
}

type ListAttempt = Parameters<typeof attemptListItemDto>[0] & {
  user: { id: string; fullName: string; email: string; isActive: boolean };
};

export function adminAttemptListItemDto(value: ListAttempt) {
  return { ...attemptListItemDto(value), user: value.user };
}
