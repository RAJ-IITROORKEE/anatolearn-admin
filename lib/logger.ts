type LogContext = {
  requestId: string;
  code: string;
  status: number;
  route?: string;
  details?: Record<string, string | number | boolean | null>;
  [key: string]: unknown;
};

export function logError({ requestId, code, status, route, details }: LogContext) {
  console.error(JSON.stringify({
    level: "error",
    requestId,
    code,
    status,
    ...(route ? { route } : {}),
    ...(details ? { details } : {}),
  }));
}
