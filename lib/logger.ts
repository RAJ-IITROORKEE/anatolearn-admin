type LogContext = {
  requestId: string;
  code: string;
  status: number;
  route?: string;
  [key: string]: unknown;
};

export function logError({ requestId, code, status, route }: LogContext) {
  console.error(JSON.stringify({
    level: "error",
    requestId,
    code,
    status,
    ...(route ? { route } : {}),
  }));
}
