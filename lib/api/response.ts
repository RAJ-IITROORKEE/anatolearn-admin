import { NextResponse } from "next/server";

export function requestId() {
  return crypto.randomUUID();
}

type ResponsePolicy = { cacheControl?: string; vary?: string };

const privatePolicy = { cacheControl: "private, no-store", vary: "Authorization, Cookie" };

function responseHeaders(id: string, policy: ResponsePolicy = privatePolicy) {
  const headers = new Headers({
    "X-Request-ID": id,
    "Cache-Control": policy.cacheControl ?? privatePolicy.cacheControl,
  });
  if (policy.vary) headers.set("Vary", policy.vary);
  return headers;
}

export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200,
  policy?: ResponsePolicy,
) {
  const id = typeof meta?.requestId === "string" ? meta.requestId : requestId();
  return NextResponse.json(
    { success: true as const, data, ...(meta ? { meta } : {}) },
    { status, headers: responseHeaders(id, policy) },
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  id: string,
  fieldErrors?: Record<string, string[]>,
) {
  return NextResponse.json(
    {
      success: false as const,
      error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), requestId: id },
    },
    { status, headers: responseHeaders(id) },
  );
}
