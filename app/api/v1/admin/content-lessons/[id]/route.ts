import { adminItemHandlers } from "@/features/content/route-handlers";
const handlers = adminItemHandlers("contentLesson");
export const { GET, PATCH, DELETE } = handlers;
