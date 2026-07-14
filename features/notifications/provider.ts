import "server-only";

import { z } from "zod";
import { notificationProviderEnvSchema } from "@/lib/env";

export const providerEnvSchema = notificationProviderEnvSchema;

export const providerConfigSchema = providerEnvSchema.transform((value) => ({
  enabled: value.EXPO_PUSH_ENABLED === "true",
  accessToken: value.EXPO_ACCESS_TOKEN,
  ready: value.EXPO_PUSH_ENABLED === "true" && Boolean(value.EXPO_ACCESS_TOKEN),
}));

const providerErrorSchema = z.object({
  status: z.literal("error"),
  message: z.string().max(1000).catch("Provider rejected the notification."),
  details: z.object({ error: z.string().max(100).optional() }).passthrough().optional(),
}).passthrough();
const ticketSchema = z.union([
  z.object({ status: z.literal("ok"), id: z.string().min(1).max(500) }).passthrough(),
  providerErrorSchema,
]);
const ticketResponseSchema = z.object({ data: z.array(ticketSchema) }).passthrough();
const receiptSchema = z.union([
  z.object({ status: z.literal("ok") }).passthrough(),
  providerErrorSchema,
]);
const receiptResponseSchema = z.object({ data: z.record(z.string(), receiptSchema) }).passthrough();

export type SendResult = { status: "TICKETED"; receiptId: string } | { status: "FAILED"; code: string; message: string };
export type ReceiptResult = { status: "SENT" } | { status: "FAILED"; code: string; message: string };

export class ProviderTransientError extends Error {
  constructor(public retryAfterMs?: number) {
    super("Notification provider is temporarily unavailable.");
  }
}

async function providerFetch(url: string, accessToken: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new ProviderTransientError();
  }
  if (response.status === 429 || response.status >= 500) {
    const seconds = Number(response.headers.get("retry-after"));
    throw new ProviderTransientError(Number.isFinite(seconds) ? seconds * 1000 : undefined);
  }
  if (!response.ok) throw new Error("Notification provider rejected the request.");
  return response.json().catch(() => { throw new Error("Notification provider returned invalid JSON."); });
}

export class ExpoPushProvider {
  constructor(private accessToken: string) {}

  async send(messages: Array<{ to: string; title: string; body: string }>): Promise<SendResult[]> {
    if (messages.length > 100) throw new Error("Expo batches may contain at most 100 messages.");
    if (!messages.length) return [];
    const response = ticketResponseSchema.parse(await providerFetch("https://exp.host/--/api/v2/push/send", this.accessToken, messages));
    if (response.data.length !== messages.length) throw new Error("Notification provider returned an invalid ticket count.");
    return response.data.map((ticket) => ticket.status === "ok"
      ? { status: "TICKETED", receiptId: ticket.id }
      : { status: "FAILED", code: ticket.details?.error ?? "PROVIDER_ERROR", message: ticket.message });
  }

  async receipts(ids: string[]): Promise<Record<string, ReceiptResult>> {
    if (ids.length > 100) throw new Error("Expo receipt batches may contain at most 100 IDs.");
    if (!ids.length) return {};
    const response = receiptResponseSchema.parse(await providerFetch("https://exp.host/--/api/v2/push/getReceipts", this.accessToken, { ids }));
    return Object.fromEntries(Object.entries(response.data).map(([id, receipt]) => [id, receipt.status === "ok"
      ? { status: "SENT" }
      : { status: "FAILED", code: receipt.details?.error ?? "PROVIDER_ERROR", message: receipt.message }]));
  }
}

export function getProviderConfig() {
  return providerConfigSchema.parse(process.env);
}

export function getExpoProvider() {
  const config = getProviderConfig();
  return config.ready && config.accessToken ? new ExpoPushProvider(config.accessToken) : null;
}
