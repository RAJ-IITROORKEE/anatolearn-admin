export class UserManagementError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "UserManagementError";
  }
}
