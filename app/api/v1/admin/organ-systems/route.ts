import { adminCollectionHandlers } from "@/features/content/route-handlers";
const handlers = adminCollectionHandlers("organSystem");
export const { GET, POST, PATCH } = handlers;
