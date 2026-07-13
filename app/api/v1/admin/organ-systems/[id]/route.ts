import { adminItemHandlers } from "@/features/content/route-handlers";
const handlers = adminItemHandlers("organSystem");
export const { GET, PATCH, DELETE } = handlers;
