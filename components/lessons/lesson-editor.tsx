"use client";

/* eslint-disable @next/next/no-img-element -- Private signed URLs are short-lived and not optimizer sources. */

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fieldClass, labelClass, panelClass } from "@/components/phase3/admin-ui";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { contentBlocksSchema, type ContentBlock } from "@/features/content/schemas";

type EditorBlock = ContentBlock & { id: string };
type BlockType = ContentBlock["type"];

const blockNames: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  callout: "Callout",
  bulletList: "Bulleted list",
  numberedList: "Numbered list",
  divider: "Divider",
};

function withId(block: ContentBlock, fallback = crypto.randomUUID()): EditorBlock {
  return { ...block, id: block.id || fallback } as EditorBlock;
}

function normalizeBlocks(blocks: ContentBlock[]) {
  const used = new Set(blocks.flatMap((block) => block.id ? [block.id] : []));
  return blocks.map((block, index) => {
    if (block.id) return withId(block);
    let id = `editor-block-${index + 1}`;
    while (used.has(id)) id = `${id}-copy`;
    used.add(id);
    return withId(block, id);
  });
}

function newBlock(type: BlockType): EditorBlock {
  const id = crypto.randomUUID();
  if (type === "heading") return { id, type, level: 2, text: "" };
  if (type === "paragraph") return { id, type, text: "" };
  if (type === "image") return { id, type, mediaId: "", altText: "", caption: null };
  if (type === "callout") return { id, type, tone: "info", title: null, text: "" };
  if (type === "bulletList") return { id, type, items: [""] };
  if (type === "numberedList") return { id, type, items: [""] };
  return { id, type: "divider" };
}

function isSemanticallyEmpty(block: EditorBlock) {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return !block.text.trim();
    case "image":
      return !block.mediaId.trim() && !block.altText.trim() && !(block.caption ?? "").trim();
    case "callout":
      return !(block.title ?? "").trim() && !block.text.trim();
    case "bulletList":
    case "numberedList":
      return block.items.every((item) => !item.trim());
    case "divider":
      return false;
  }
}

function LessonPreview({ blocks, media }: { blocks: unknown; media: ReadonlyMap<string, string> }) {
  const parsed = contentBlocksSchema.safeParse(blocks);
  if (!parsed.success) return <p className="rounded-xl bg-subtle p-4 text-sm text-muted">Complete required block fields to see the validated learner preview.</p>;
  return <div className="grid gap-5">{parsed.data.map((block) => {
    const key = block.id ?? `${block.type}-${JSON.stringify(block)}`;
    if (block.type === "heading") {
      if (block.level === 2) return <h2 className="text-2xl font-bold" key={key}>{block.text}</h2>;
      if (block.level === 3) return <h3 className="text-xl font-bold" key={key}>{block.text}</h3>;
      return <h4 className="text-lg font-bold" key={key}>{block.text}</h4>;
    }
    if (block.type === "paragraph") return <p className="whitespace-pre-wrap text-sm leading-7 text-body" key={key}>{block.text}</p>;
    if (block.type === "image") {
       const preview = media.get(block.id ?? "");
       return <figure key={key}>{preview ? <img alt={block.altText} className="max-h-96 w-full rounded-xl object-contain" src={preview} /> : <div className="flex min-h-40 items-center justify-center rounded-xl bg-subtle p-5 text-center text-sm font-semibold text-muted">Upload an image to preview it here.</div>}{block.caption ? <figcaption className="mt-2 text-center text-xs text-muted">{block.caption}</figcaption> : null}</figure>;
    }
    if (block.type === "callout") return <aside className={`rounded-xl border p-4 ${block.tone === "warning" ? "border-warning/30 bg-amber-50" : block.tone === "success" ? "border-success/30 bg-success-soft" : "border-primary/20 bg-primary-soft"}`} key={key}>{block.title ? <p className="font-bold">{block.title}</p> : null}<p className="mt-1 whitespace-pre-wrap text-sm leading-6">{block.text}</p></aside>;
    if (block.type === "bulletList") return <ul className="list-disc space-y-2 pl-6 text-sm text-body" key={key}>{block.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
    if (block.type === "numberedList") return <ol className="list-decimal space-y-2 pl-6 text-sm text-body" key={key}>{block.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>;
    return <hr className="border-border" key={key} />;
  })}</div>;
}

export function LessonEditor({ initialBlocks }: { initialBlocks: ContentBlock[] }) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => normalizeBlocks(initialBlocks));
  const [type, setType] = useState<BlockType>("paragraph");
  const [media, setMedia] = useState<Map<string, string>>(new Map());
  const [newBlockIds, setNewBlockIds] = useState<Set<string>>(new Set());
  const serializedInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    serializedInput.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [blocks]);
  useEffect(() => () => { for (const url of media.values()) URL.revokeObjectURL(url); }, [media]);
  const checked = contentBlocksSchema.safeParse(blocks);
  const errors = checked.success ? [] : [...new Set(checked.error.issues.map((issue) => {
    const index = typeof issue.path[0] === "number" ? issue.path[0] + 1 : null;
    return `${index ? `Block ${index}: ` : ""}${issue.message}`;
  }))];
  const replace = (index: number, block: EditorBlock) => setBlocks((current) => current.map((entry, entryIndex) => entryIndex === index ? block : entry));
  const move = (index: number, direction: -1 | 1) => setBlocks((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const remove = (id: string) => {
    setBlocks((current) => current.filter((entry) => entry.id !== id));
    setNewBlockIds((current) => { const next = new Set(current); next.delete(id); return next; });
  };
  const duplicate = (block: EditorBlock, index: number) => {
    const copy = withId({ ...block, id: undefined });
    setBlocks((current) => [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]);
    setNewBlockIds((current) => new Set(current).add(copy.id));
  };
  const add = () => {
    const block = newBlock(type);
    setBlocks((current) => [...current, block]);
    setNewBlockIds((current) => new Set(current).add(block.id));
  };

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]">
    <section aria-label="Lesson blocks" className="grid gap-4">
      <input name="contentBlocks" ref={serializedInput} type="hidden" value={JSON.stringify(blocks)} />
      {errors.length ? <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive" role="alert"><p className="font-bold">Complete the lesson blocks</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      {blocks.map((block, index) => <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm focus-within:ring-2 focus-within:ring-primary" data-testid="lesson-block" key={block.id} onKeyDown={(event) => { if (!event.altKey) return; if (event.key === "ArrowUp") { event.preventDefault(); move(index, -1); } if (event.key === "ArrowDown") { event.preventDefault(); move(index, 1); } }} tabIndex={0}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{index + 1}. {blockNames[block.type]}</p><div className="flex flex-wrap gap-1">
          <button aria-label="Move block up" className="inline-flex size-11 items-center justify-center rounded-xl border border-border disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowUp aria-hidden className="size-4" /></button>
          <button aria-label="Move block down" className="inline-flex size-11 items-center justify-center rounded-xl border border-border disabled:opacity-30" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} type="button"><ArrowDown aria-hidden className="size-4" /></button>
          <button aria-label="Duplicate block" className="inline-flex size-11 items-center justify-center rounded-xl border border-border" onClick={() => duplicate(block, index)} type="button"><Copy aria-hidden className="size-4" /></button>
          {newBlockIds.has(block.id) && isSemanticallyEmpty(block) ? <button aria-label="Remove block" className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-destructive" onClick={() => remove(block.id)} type="button"><Trash2 aria-hidden className="size-4" /></button> : <ConfirmationDialog confirmLabel="Delete block" description="This block contains lesson content. Deleting it cannot be undone after you save the lesson." onConfirm={() => remove(block.id)} title={`Remove ${blockNames[block.type]} block?`}><button aria-label="Remove block" className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-destructive" type="button"><Trash2 aria-hidden className="size-4" /></button></ConfirmationDialog>}
        </div></div>
        {block.type === "heading" ? <div className="grid gap-3 sm:grid-cols-[120px_1fr]"><label className={labelClass}>Level<select className={fieldClass} onChange={(event) => replace(index, { ...block, level: Number(event.target.value) as 2 | 3 | 4 })} value={block.level}><option value="2">Heading 2</option><option value="3">Heading 3</option><option value="4">Heading 4</option></select></label><label className={labelClass}>Heading text<input className={fieldClass} maxLength={200} onChange={(event) => replace(index, { ...block, text: event.target.value })} required value={block.text} /></label></div> : null}
        {block.type === "paragraph" ? <label className={labelClass}>Paragraph text<textarea className={`${fieldClass} min-h-32 py-3`} maxLength={5000} onChange={(event) => replace(index, { ...block, text: event.target.value })} required value={block.text} /></label> : null}
         {block.type === "image" ? <div className="grid gap-4 rounded-xl border border-border bg-subtle p-4"><label className={labelClass}>Lesson image <span className="font-normal text-muted">Upload to replace{block.mediaId ? "; existing image is retained unless replaced or cleared" : ""}</span><input accept="image/png,image/jpeg,image/webp" className={`${fieldClass} py-2`} name={`lessonFile.${block.id}`} onChange={(event) => { const file = event.target.files?.[0]; setMedia((current) => { const next = new Map(current); const old = next.get(block.id); if (old) URL.revokeObjectURL(old); if (file) next.set(block.id, URL.createObjectURL(file)); else next.delete(block.id); return next; }); }} type="file" /></label><label className={labelClass}>Image alt text <span className="font-normal text-muted">Optional</span><input className={fieldClass} maxLength={300} name={`lessonAltText.${block.id}`} onChange={(event) => replace(index, { ...block, altText: event.target.value })} value={block.altText} /></label>{block.mediaId ? <label className="flex items-center gap-2 text-sm text-muted"><input name={`lessonClear.${block.id}`} type="checkbox" />Remove the existing image</label> : null}<label className={labelClass}>Caption <span className="font-normal text-muted">Optional</span><input className={fieldClass} maxLength={500} onChange={(event) => replace(index, { ...block, caption: event.target.value || null })} value={block.caption ?? ""} /></label></div> : null}
        {block.type === "callout" ? <div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Tone<select className={fieldClass} onChange={(event) => replace(index, { ...block, tone: event.target.value as "info" | "warning" | "success" })} value={block.tone}><option value="info">Information</option><option value="warning">Warning</option><option value="success">Success</option></select></label><label className={labelClass}>Title <span className="font-normal text-muted">Optional</span><input className={fieldClass} onChange={(event) => replace(index, { ...block, title: event.target.value || null })} value={block.title ?? ""} /></label></div><label className={labelClass}>Callout text<textarea className={`${fieldClass} min-h-28 py-3`} onChange={(event) => replace(index, { ...block, text: event.target.value })} required value={block.text} /></label></div> : null}
        {block.type === "bulletList" || block.type === "numberedList" ? <label className={labelClass}>List items <span className="font-normal text-muted">One item per line</span><textarea className={`${fieldClass} min-h-32 py-3`} onChange={(event) => replace(index, { ...block, items: event.target.value.split("\n") })} required value={block.items.join("\n")} /></label> : null}
        {block.type === "divider" ? <p className="text-sm text-muted">A horizontal divider will separate lesson sections.</p> : null}
      </article>)}
      {!blocks.length ? <div className="rounded-2xl border border-dashed border-border bg-subtle p-8 text-center text-sm text-muted">No blocks yet. Add the first structured block below.</div> : null}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-subtle p-4 sm:flex-row sm:items-end"><label className={`${labelClass} flex-1`}>Block type<select aria-label="Block type" className={fieldClass} onChange={(event) => setType(event.target.value as BlockType)} value={type}>{Object.entries(blockNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white" onClick={add} type="button"><Plus aria-hidden className="size-4" />Add block</button></div>
      <p className="text-xs text-muted">Keyboard: focus a block and press Alt+Up or Alt+Down to move it.</p>
    </section>
    <aside aria-label="Learner lesson preview" className={`${panelClass} h-fit xl:sticky xl:top-24`}><p className="mb-5 text-sm font-bold text-primary">Learner preview</p><LessonPreview blocks={blocks} media={media} /></aside>
  </div>;
}
