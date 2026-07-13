import { NextResponse } from "next/server";

export function requestId() {
  return crypto.randomUUID();
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true as const, data, ...(meta ? { meta } : {}) }, { status });
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
    { status },
  );
}
