"use client";

import { useState } from "react";

export function CopySignedUrlButton({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  return <div className="mt-3"><button className="min-h-10 rounded-xl border border-border px-3 text-sm font-semibold" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("Temporary URL copied."); } catch { setMessage("Could not copy the temporary URL."); } }} type="button">Copy current temporary signed URL</button><span aria-live="polite" className="ml-2 text-xs text-muted">{message}</span></div>;
}
