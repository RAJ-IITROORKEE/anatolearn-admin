"use client";

/* eslint-disable @next/next/no-img-element -- Local blob URLs are used for pre-upload previews. */

import { useEffect, useState } from "react";

import { fieldClass, labelClass } from "@/components/phase3/admin-ui";

export function DirectImageInput({ label, fileName, altTextName, mediaIdName, clearName, existingMediaId, existingAltText }: { label: string; fileName: string; altTextName: string; mediaIdName?: string; clearName?: string; existingMediaId?: string | null; existingAltText?: string | null }) {
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  return <div className="grid gap-3 rounded-xl border border-border bg-subtle p-4">
    <label className={labelClass}>{label} <span className="font-normal text-muted">Optional. Upload to replace{existingMediaId ? "; existing image is retained unless replaced or cleared" : ""}</span><input accept="image/png,image/jpeg,image/webp" className={`${fieldClass} py-2`} name={fileName} onChange={(event) => { const file = event.target.files?.[0]; setPreview((current) => { if (current) URL.revokeObjectURL(current.url); return file ? { name: file.name, url: URL.createObjectURL(file) } : null; }); }} type="file" /></label>
    {preview ? <figure><div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface"><img alt={`Local preview of ${preview.name}`} className="h-full w-full object-contain" src={preview.url} /></div><figcaption className="mt-2 text-xs text-muted">Local preview. The image uploads when you save.</figcaption></figure> : null}
    <label className={labelClass}>Alt text <span className="font-normal text-muted">Optional; max 500 characters</span><input className={fieldClass} defaultValue={existingAltText ?? ""} maxLength={500} name={altTextName} /></label>
    {mediaIdName ? <input name={mediaIdName} type="hidden" value={existingMediaId ?? ""} /> : null}
    {clearName ? <label className="flex items-center gap-2 text-sm text-muted"><input name={clearName} type="checkbox" />Remove the existing image</label> : null}
  </div>;
}
