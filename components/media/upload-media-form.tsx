"use client";

/* eslint-disable @next/next/no-img-element -- Local blob URLs must render directly before upload. */

import * as Dialog from "@radix-ui/react-dialog";
import { ImagePlus, Upload, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { type ActionState, type FormAction } from "@/components/phase3/action-form";
import { ActionNotice, fieldClass, labelClass } from "@/components/phase3/admin-ui";
import { Button } from "@/components/ui/button";
import { formatMediaBytes } from "./media-library";

const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type Preview = { width: number | null; height: number | null; url: string };

export function UploadMediaForm({ action, onSuccess }: { action: FormAction; onSuccess?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewUrl = preview?.url;
  const [localError, setLocalError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    if (!file) return { error: "Choose an image to upload." };
    formData.set("file", file);
    const next = await action(previous, formData);
    if (next.error) toast.error(next.error);
    if (next.success) {
      toast.success(next.success);
      formRef.current?.reset();
      setFile(null);
      setPreview(null);
      onSuccess?.();
    }
    return next;
  }, {});

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const chooseFile = (next: File | undefined) => {
    if (!next) {
      setFile(null);
      setPreview(null);
      setLocalError("");
      return;
    }
    if (!acceptedTypes.has(next.type)) {
      setFile(null);
      setPreview(null);
      setLocalError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    setFile(next);
    setPreview({ height: null, url: URL.createObjectURL(next), width: null });
    setLocalError("");
  };

  return <form action={formAction} className="grid gap-5" ref={formRef}>
    <ActionNotice state={localError ? { error: localError } : state} />
    <label className="grid cursor-pointer gap-3" data-testid="media-drop-zone" onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
      <span className="text-sm font-semibold text-body">Image file</span>
      <span className={`flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-6 text-center transition-colors ${dragging ? "border-primary bg-primary-soft" : "border-border bg-subtle hover:border-primary/50"}`}>
        <ImagePlus aria-hidden className="size-7 text-primary" />
        <span className="mt-2 text-sm font-semibold text-foreground">Drop an image here or choose a file</span>
        <span className="mt-1 text-xs text-muted">PNG, JPEG, or WebP</span>
      </span>
      <input accept="image/png,image/jpeg,image/webp" aria-label="Image file" className={`${fieldClass} py-2`} onChange={(event) => chooseFile(event.target.files?.[0])} type="file" />
    </label>
    {file && preview ? <figure className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-subtle"><img alt={`Local preview of ${file.name}`} className="h-full w-full object-contain" onLoad={(event) => { const width = event.currentTarget.naturalWidth || null; const height = event.currentTarget.naturalHeight || null; setPreview((current) => current ? { ...current, width, height } : current); }} src={preview.url} /></div>
      <figcaption className="min-w-0 self-center">
        <p className="truncate font-semibold text-foreground" title={file.name}>{file.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="font-semibold text-muted">Size</dt><dd className="mt-1 text-body">{formatMediaBytes(String(file.size))}</dd></div><div><dt className="font-semibold text-muted">MIME</dt><dd className="mt-1 break-all text-body">{file.type}</dd></div><div className="col-span-2"><dt className="font-semibold text-muted">Dimensions</dt><dd className="mt-1 text-body">{preview.width && preview.height ? `${preview.width} x ${preview.height}` : "Reading image..."}</dd></div></dl>
        <p className="mt-3 text-xs text-muted">Local preview only. Nothing is uploaded until Save image.</p>
      </figcaption>
    </figure> : null}
    <label className={labelClass}>Alt text <span className="font-normal text-muted">Optional</span><textarea className={`${fieldClass} min-h-24 py-3`} maxLength={500} name="altText" /></label>
    <div className="flex justify-end border-t border-border pt-5"><Button disabled={pending || !file} type="submit">{pending ? "Saving..." : "Save image"}</Button></div>
  </form>;
}

export function UploadMediaDialog({ action }: { action: FormAction }) {
  const [open, setOpen] = useState(false);
  return <Dialog.Root onOpenChange={setOpen} open={open}>
    <Dialog.Trigger asChild><Button><Upload aria-hidden className="size-4" />Upload image</Button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" />
      <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl focus:outline-none sm:left-1/2 sm:w-[min(720px,calc(100%-2rem))] sm:-translate-x-1/2 sm:p-6">
        <div className="pr-12"><Dialog.Title className="text-xl font-bold text-foreground">Upload image</Dialog.Title><Dialog.Description className="mt-1 text-sm leading-6 text-muted">PNG, JPEG, or WebP up to the configured upload limit.</Dialog.Description></div>
        <Dialog.Close asChild><Button aria-label="Close upload dialog" className="absolute right-4 top-4" size="icon" variant="ghost"><X aria-hidden className="size-5" /></Button></Dialog.Close>
        <div className="mt-5"><UploadMediaForm action={action} onSuccess={() => setOpen(false)} /></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
