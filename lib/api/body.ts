import { z } from "zod";

const emptyJsonObjectSchema = z.object({}).strict();

export async function parseEmptyJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  return emptyJsonObjectSchema.parse(body);
}
