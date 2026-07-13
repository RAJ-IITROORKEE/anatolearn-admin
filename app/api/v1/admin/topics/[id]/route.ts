import { adminItemHandlers } from "@/features/content/route-handlers";
const handlers = adminItemHandlers("topic");
export const { GET, PATCH, DELETE } = handlers;
