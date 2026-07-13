import { adminCollectionHandlers } from "@/features/content/route-handlers";
const handlers = adminCollectionHandlers("contentLesson");
export const { GET, POST, PATCH } = handlers;
