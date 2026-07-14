"use client";

/* eslint-disable @next/next/no-img-element -- Local blob URLs must render directly before upload. */

import { useEffect, useState } from "react";

import { ActionForm, type FormAction } from "@/components/phase3/action-form";
import { fieldClass, labelClass } from "@/components/phase3/admin-ui";

export function UploadMediaForm({ action }: { action: FormAction }) {
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  return <ActionForm action={action} label="Upload image" pendingLabel="Uploading">
    <label className={labelClass}>Image file<input accept="image/png,image/jpeg,image/webp" className={`${fieldClass} py-2`} name="file" onChange={(event) => { const file = event.target.files?.[0]; setPreview(file ? { name: file.name, url: URL.createObjectURL(file) } : null); }} required type="file" /></label>
    {preview ? <figure><div className="aspect-[4/3] overflow-hidden rounded-xl bg-subtle"><img alt={`Local preview of ${preview.name}`} className="h-full w-full object-contain" src={preview.url} /></div><figcaption className="mt-2 text-xs text-muted">Local preview. The image has not been uploaded yet.</figcaption></figure> : null}
    <label className={labelClass}>Alt text<textarea className={`${fieldClass} min-h-24 py-3`} maxLength={500} name="altText" required /></label>
    <p className="text-xs leading-5 text-muted">PNG, JPEG, or WebP. The server verifies image contents and configured size limits.</p>
  </ActionForm>;
}
