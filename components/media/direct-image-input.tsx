"use client";

/* eslint-disable @next/next/no-img-element -- Local blob URLs are used for pre-upload previews. */

import { useEffect, useRef, useState } from "react";

import { fieldClass, labelClass } from "@/components/phase3/admin-ui";

type DirectImageInputProps = {
  label: string;
  fileName: string;
  altTextName: string;
  mediaIdName?: string;
  clearName?: string;
  existingMediaId?: string | null;
  existingAltText?: string | null;
  existingPreviewUrl?: string | null;
  compact?: boolean;
};

export function DirectImageInput({ label, fileName, altTextName, mediaIdName, clearName, existingMediaId, existingAltText, existingPreviewUrl, compact = false }: DirectImageInputProps) {
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const updatePreview = (file?: File) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewRef.current = url;
    setPreview(file && url ? { name: file.name, url } : null);
  };
  const source = preview?.url ?? existingPreviewUrl;
  const previewAlt = preview ? `Local preview of ${preview.name}` : existingAltText || label;

  return <section aria-label={label} className={`grid gap-3 rounded-xl border border-border bg-subtle ${compact ? "p-3" : "p-4"} ${source ? "sm:grid-cols-[6rem_minmax(0,1fr)]" : ""}`} data-compact={String(compact)}>
    {source ? <figure className="row-span-2"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface"><img alt={previewAlt} className="h-full w-full object-contain" src={source} /></div>{preview ? <figcaption className="mt-1 max-w-24 text-xs text-muted">Uploads on save.</figcaption> : null}</figure> : null}
    <label className={labelClass}>{label} <span className="font-normal text-muted">Optional. Upload to replace{existingMediaId ? "; existing image is retained unless replaced or cleared" : ""}</span><input accept="image/png,image/jpeg,image/webp" className={`${fieldClass} py-2`} name={fileName} onChange={(event) => updatePreview(event.target.files?.[0])} type="file" /></label>
    <label className={labelClass}>{existingMediaId ? "Replacement alt text" : "Alt text"} <span className="font-normal text-muted">Optional; applies to a new upload, max 500 characters</span><input className={fieldClass} defaultValue="" maxLength={500} name={altTextName} placeholder={existingMediaId && existingAltText ? existingAltText : undefined} /></label>
    {mediaIdName ? <input name={mediaIdName} type="hidden" value={existingMediaId ?? ""} /> : null}
    {clearName && existingMediaId ? <label className="flex items-center gap-2 text-sm text-muted sm:col-start-2"><input name={clearName} type="checkbox" />Remove the existing image</label> : null}
  </section>;
}
