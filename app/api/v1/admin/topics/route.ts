import { adminCollectionHandlers } from "@/features/content/route-handlers";
const handlers = adminCollectionHandlers("topic");
export const { GET, POST, PATCH } = handlers;
