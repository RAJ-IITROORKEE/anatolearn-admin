"use client";

/* eslint-disable @next/next/no-img-element -- Local blobs and short-lived private signed URLs are not optimizer sources. */

import * as Dialog from "@radix-ui/react-dialog";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, Extension, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Eye, Highlighter, ImagePlus, Italic, Link2,
  List, ListOrdered, Quote, Redo2, RemoveFormatting, Strikethrough, UnderlineIcon, Undo2, X,
} from "lucide-react";
import { type CSSProperties, type DragEvent, type ReactNode, useEffect, useRef, useState } from "react";

import {
  legacyBlocksToRichContent,
  richContentToLegacyBlocks,
  richTextColors,
  richTextDraftDocumentSchema,
  richTextFontSizes,
  richTextHighlights,
  type ContentBlock,
  type RichTextDocument,
  type RichTextNode,
} from "@/features/content/schemas";

type ExistingMedia = Record<string, { signedUrl: string; altText: string }>;
type PendingMedia = { file: File; name: string; url: string };
type PendingMediaMap = Map<string, PendingMedia>;
type RichTextDraftDocument = ReturnType<typeof richTextDraftDocumentSchema.parse>;

const acceptedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const LegacyMetadata = Extension.create({
  name: "legacyMetadata",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "horizontalRule"],
        attributes: { legacyId: { default: null, rendered: false, keepOnSplit: false } },
      },
      {
        types: ["blockquote"],
        attributes: { tone: { default: null, rendered: false }, title: { default: null, rendered: false } },
      },
    ];
  },
});

const ManagedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: { default: null, rendered: false },
      uploadId: { default: null, rendered: false },
      caption: { default: null, rendered: false },
      legacyId: { default: null, rendered: false, keepOnSplit: false },
    };
  },
}).configure({ allowBase64: false, HTMLAttributes: { class: "mx-auto max-h-[28rem] max-w-full rounded-xl object-contain" } });

const editorExtensions = [
  StarterKit.configure({
    code: false, codeBlock: false, hardBreak: false, heading: { levels: [2, 3, 4] }, link: false,
    trailingNode: false, underline: false,
  }),
  Underline,
  Link.configure({ autolink: false, linkOnPaste: false, openOnClick: false }),
  TextStyle,
  FontSize,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
  LegacyMetadata,
  ManagedImage,
];

function cleanAttrs(attrs: Record<string, unknown> | undefined, names: string[]) {
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const value = attrs?.[name];
    if (value !== null && value !== undefined && value !== "") result[name] = value;
  }
  return result;
}

function sanitizeMark(mark: JSONContent) {
  if (["bold", "italic", "underline", "strike"].includes(mark.type ?? "")) return { type: mark.type };
  if (mark.type === "link") return { type: "link", attrs: { href: String(mark.attrs?.href ?? "") } };
  if (mark.type === "highlight") return { type: "highlight", attrs: { color: String(mark.attrs?.color ?? "") } };
  if (mark.type === "textStyle") return { type: "textStyle", attrs: cleanAttrs(mark.attrs, ["fontSize", "color"]) };
  return null;
}

function sanitizeNode(node: JSONContent): RichTextNode {
  if (node.type === "text") {
    const marks = (node.marks ?? []).map(sanitizeMark).filter((mark): mark is NonNullable<typeof mark> => Boolean(mark));
    return { type: "text", text: node.text ?? "", ...(marks.length ? { marks: marks as RichTextNode["marks"] } : {}) };
  }
  const content = node.content?.map(sanitizeNode);
  if (node.type === "heading") return { type: "heading", attrs: cleanAttrs(node.attrs, ["level", "textAlign", "legacyId"]), ...(content?.length ? { content } : {}) };
  if (node.type === "paragraph") {
    const attrs = cleanAttrs(node.attrs, ["textAlign", "legacyId"]);
    return { type: "paragraph", ...(Object.keys(attrs).length ? { attrs } : {}), ...(content?.length ? { content } : {}) };
  }
  if (node.type === "image") return { type: "image", attrs: { ...cleanAttrs(node.attrs, ["mediaId", "uploadId", "legacyId"]), alt: String(node.attrs?.alt ?? ""), caption: typeof node.attrs?.caption === "string" ? node.attrs.caption : null } };
  if (node.type === "blockquote") {
    const attrs = cleanAttrs(node.attrs, ["legacyId", "tone", "title"]);
    return { type: "blockquote", ...(Object.keys(attrs).length ? { attrs } : {}), content: content ?? [] };
  }
  if (node.type === "bulletList" || node.type === "orderedList" || node.type === "horizontalRule") {
    const attrs = cleanAttrs(node.attrs, ["legacyId"]);
    return { type: node.type, ...(Object.keys(attrs).length ? { attrs } : {}), ...(content?.length ? { content } : {}) };
  }
  return { type: node.type ?? "listItem", ...(content?.length ? { content } : {}) };
}

function sanitizedDocumentValue(value: JSONContent) {
  const content = (value.content ?? []).map(sanitizeNode);
  const seenIds = new Set<string>();
  const stack = [...content];
  while (stack.length) {
    const node = stack.pop()!;
    const id = typeof node.attrs?.legacyId === "string" ? node.attrs.legacyId : null;
    if (id && seenIds.has(id)) {
      delete node.attrs?.legacyId;
      if (node.attrs && Object.keys(node.attrs).length === 0) delete node.attrs;
    } else if (id) {
      seenIds.add(id);
    }
    if (node.content) stack.push(...node.content);
  }
  return { type: "doc" as const, content };
}

function addPreviewSources(document: RichTextDocument, existingMedia: ExistingMedia): JSONContent {
  const hydrate = (node: RichTextNode): JSONContent => {
    if (node.type === "image") {
      const mediaId = String(node.attrs?.mediaId ?? "");
      return { ...node, attrs: { ...node.attrs, src: existingMedia[mediaId]?.signedUrl ?? "", alt: String(node.attrs?.alt ?? existingMedia[mediaId]?.altText ?? "") } };
    }
    return { ...node, ...(node.content ? { content: node.content.map(hydrate) } : {}) };
  };
  return hydrate(document);
}

function serialize(document: RichTextDraftDocument) {
  return JSON.stringify({
    version: 2,
    richContent: document,
    fallbackBlocks: richContentToLegacyBlocks(document as RichTextDocument),
  });
}

function assignPendingFile(input: HTMLInputElement | null, file: File) {
  if (!input || input.files?.[0] === file || typeof DataTransfer === "undefined") return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

function ToolbarButton({ active = false, disabled = false, label, onClick, children }: { active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} aria-pressed={active} className={`inline-flex size-10 items-center justify-center rounded-lg border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-body hover:border-primary/40"}`} disabled={disabled} onClick={onClick} title={label} type="button">{children}</button>;
}

function RichToolbar({ editor, onImage }: { editor: NonNullable<ReturnType<typeof useEditor>>; onImage: () => void }) {
  const chain = () => editor.chain().focus(undefined, { scrollIntoView: false });
  const setLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL (http, https, mailto, or /path)", current ?? "https://");
    if (href === null) return;
    if (!href.trim()) editor.chain().focus(undefined, { scrollIntoView: false }).unsetLink().run();
    else editor.chain().focus(undefined, { scrollIntoView: false }).setLink({ href: href.trim() }).run();
  };
  return <div aria-label="Rich text formatting" className="flex flex-wrap gap-2 border-b border-border bg-subtle p-3" role="toolbar">
    <ToolbarButton active={editor.isActive("paragraph")} label="Paragraph" onClick={() => chain().setParagraph().run()}>P</ToolbarButton>
    {([2, 3, 4] as const).map((level) => <ToolbarButton active={editor.isActive("heading", { level })} key={level} label={`Heading ${level}`} onClick={() => chain().toggleHeading({ level }).run()}>H{level}</ToolbarButton>)}
    <span aria-hidden className="mx-1 w-px bg-border" />
    <ToolbarButton active={editor.isActive("bold")} label="Bold" onClick={() => chain().toggleBold().run()}><Bold className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("italic")} label="Italic" onClick={() => chain().toggleItalic().run()}><Italic className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("underline")} label="Underline" onClick={() => chain().toggleUnderline().run()}><UnderlineIcon className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("strike")} label="Strike" onClick={() => chain().toggleStrike().run()}><Strikethrough className="size-4" /></ToolbarButton>
    <select aria-label="Font size" className="h-10 rounded-lg border border-border bg-surface px-2 text-sm" defaultValue="" onChange={(event) => { if (event.target.value) chain().setFontSize(event.target.value).run(); else chain().unsetFontSize().run(); }}>
      <option value="">Size</option>{richTextFontSizes.map((size) => <option key={size} value={size}>{size.replace("px", "")}</option>)}
    </select>
    <label className="relative inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-sm"><span className="sr-only">Text color</span><span aria-hidden>A</span><select aria-label="Text color" className="absolute inset-0 cursor-pointer opacity-0" defaultValue="" onChange={(event) => { if (event.target.value) chain().setColor(event.target.value).run(); else chain().unsetColor().run(); }}><option value="">Default</option>{richTextColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
    <label className="relative inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-sm"><Highlighter aria-hidden className="size-4" /><select aria-label="Highlight color" className="absolute inset-0 cursor-pointer opacity-0" defaultValue="" onChange={(event) => { if (event.target.value) chain().setHighlight({ color: event.target.value }).run(); else chain().unsetHighlight().run(); }}><option value="">None</option>{richTextHighlights.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
    <span aria-hidden className="mx-1 w-px bg-border" />
    <ToolbarButton active={editor.isActive({ textAlign: "left" })} label="Align left" onClick={() => chain().setTextAlign("left").run()}><AlignLeft className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive({ textAlign: "center" })} label="Align center" onClick={() => chain().setTextAlign("center").run()}><AlignCenter className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive({ textAlign: "right" })} label="Align right" onClick={() => chain().setTextAlign("right").run()}><AlignRight className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("bulletList")} label="Bulleted list" onClick={() => chain().toggleBulletList().run()}><List className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("orderedList")} label="Ordered list" onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("blockquote")} label="Block quote" onClick={() => chain().toggleBlockquote().run()}><Quote className="size-4" /></ToolbarButton>
    <ToolbarButton active={editor.isActive("link")} label="Add link" onClick={setLink}><Link2 className="size-4" /></ToolbarButton>
    <ToolbarButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="size-4" /></ToolbarButton>
    <ToolbarButton label="Insert managed image" onClick={onImage}><ImagePlus className="size-4" /></ToolbarButton>
    <span aria-hidden className="mx-1 w-px bg-border" />
    <ToolbarButton disabled={!editor.can().chain().focus().undo().run()} label="Undo" onClick={() => chain().undo().run()}><Undo2 className="size-4" /></ToolbarButton>
    <ToolbarButton disabled={!editor.can().chain().focus().redo().run()} label="Redo" onClick={() => chain().redo().run()}><Redo2 className="size-4" /></ToolbarButton>
  </div>;
}

function markedText(node: RichTextNode, key: string) {
  let result: ReactNode = node.text ?? "";
  for (const [index, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-${index}`;
    if (mark.type === "bold") result = <strong key={markKey}>{result}</strong>;
    else if (mark.type === "italic") result = <em key={markKey}>{result}</em>;
    else if (mark.type === "underline") result = <u key={markKey}>{result}</u>;
    else if (mark.type === "strike") result = <s key={markKey}>{result}</s>;
    else if (mark.type === "link") result = <a className="text-primary underline" href={String(mark.attrs?.href)} key={markKey} rel="noreferrer">{result}</a>;
    else if (mark.type === "highlight") result = <mark key={markKey} style={{ backgroundColor: String(mark.attrs?.color) }}>{result}</mark>;
    else if (mark.type === "textStyle") result = <span key={markKey} style={{ color: mark.attrs?.color as string | undefined, fontSize: mark.attrs?.fontSize as string | undefined }}>{result}</span>;
  }
  return result;
}

function PreviewNode({ node, existingMedia, pendingMedia, nodeKey }: { node: RichTextNode; existingMedia: ExistingMedia; pendingMedia: PendingMediaMap; nodeKey: string }) {
  const children = node.content?.map((child, index) => child.type === "text" ? markedText(child, `${nodeKey}-${index}`) : <PreviewNode existingMedia={existingMedia} key={`${nodeKey}-${index}`} node={child} nodeKey={`${nodeKey}-${index}`} pendingMedia={pendingMedia} />);
  const align = node.attrs?.textAlign as CSSProperties["textAlign"] | undefined;
  if (node.type === "paragraph") return <p className="min-h-6 leading-7 text-body" style={{ textAlign: align }}>{children}</p>;
  if (node.type === "heading") {
    if (node.attrs?.level === 2) return <h2 className="text-2xl font-bold" style={{ textAlign: align }}>{children}</h2>;
    if (node.attrs?.level === 3) return <h3 className="text-xl font-bold" style={{ textAlign: align }}>{children}</h3>;
    return <h4 className="text-lg font-bold" style={{ textAlign: align }}>{children}</h4>;
  }
  if (node.type === "image") {
    const uploadId = String(node.attrs?.uploadId ?? "");
    const mediaId = String(node.attrs?.mediaId ?? "");
    const source = pendingMedia.get(uploadId)?.url ?? existingMedia[mediaId]?.signedUrl;
    return <figure>{source ? <img alt={String(node.attrs?.alt ?? existingMedia[mediaId]?.altText ?? "")} className="mx-auto max-h-96 max-w-full rounded-xl object-contain" src={source} /> : <div className="rounded-xl bg-subtle p-6 text-center text-sm text-muted">Managed image preview unavailable.</div>}{node.attrs?.caption ? <figcaption className="mt-2 text-center text-xs text-muted">{String(node.attrs.caption)}</figcaption> : null}</figure>;
  }
  if (node.type === "bulletList") return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
  if (node.type === "orderedList") return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
  if (node.type === "listItem") return <li>{children}</li>;
  if (node.type === "blockquote") return <blockquote className="border-l-4 border-primary/30 bg-primary-soft px-4 py-3 text-body">{node.attrs?.title ? <p className="mb-1 font-bold">{String(node.attrs.title)}</p> : null}{children}</blockquote>;
  if (node.type === "horizontalRule") return <hr className="border-border" />;
  return <>{children}</>;
}

function RichPreview({ document, existingMedia, pendingMedia }: { document: RichTextDraftDocument; existingMedia: ExistingMedia; pendingMedia: PendingMediaMap }) {
  if (!document.content.length) return <p className="rounded-xl bg-subtle p-4 text-sm text-muted">Add lesson content to see the learner preview.</p>;
  return <div className="grid gap-5">{document.content.map((node, index) => <PreviewNode existingMedia={existingMedia} key={index} node={node} nodeKey={String(index)} pendingMedia={pendingMedia} />)}</div>;
}

export function LessonEditor({ initialBlocks, initialRichContent, existingMedia = {} }: { initialBlocks: ContentBlock[]; initialRichContent?: RichTextDocument; existingMedia?: ExistingMedia }) {
  const initialDocument = initialRichContent ?? legacyBlocksToRichContent(initialBlocks);
  const editableInitialDocument = initialDocument.content.length ? initialDocument : { type: "doc" as const, content: [{ type: "paragraph" }] };
  const initialDraft = richTextDraftDocumentSchema.parse(initialDocument);
  const [richDocument, setRichDocument] = useState(initialDraft);
  const [serialized, setSerialized] = useState(() => serialize(initialDraft));
  const [editorError, setEditorError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaMap>(new Map());
  const [editorRevision, setEditorRevision] = useState(0);
  const pendingRef = useRef(pendingMedia);
  const pickerRef = useRef<HTMLInputElement>(null);
  const serializedRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);

  const createPendingImage = (file: File) => {
    if (!acceptedImageTypes.has(file.type)) return null;
    const uploadId = crypto.randomUUID();
    const value = { file, name: file.name, url: URL.createObjectURL(file) };
    setPendingMedia((current) => {
      const next = new Map(current).set(uploadId, value);
      pendingRef.current = next;
      return next;
    });
    return { uploadId, value };
  };

  const editor = useEditor({
    extensions: editorExtensions,
    content: addPreviewSources(editableInitialDocument, existingMedia),
    immediatelyRender: false,
    editorProps: { attributes: {
      "aria-label": "Lesson rich text editor",
      class: "min-h-[28rem] px-5 py-6 text-[16px] leading-7 text-body outline-none sm:px-8 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary-soft [&_blockquote]:px-4 [&_blockquote]:py-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-bold [&_h4]:text-lg [&_h4]:font-bold [&_hr]:my-6 [&_li]:ml-6 [&_ol]:list-decimal [&_p]:min-h-6 [&_ul]:list-disc",
      role: "textbox",
    } },
    onUpdate({ editor: current }) {
      const raw = sanitizedDocumentValue(current.getJSON());
      const checked = richTextDraftDocumentSchema.safeParse(raw);
      if (checked.success) {
        setEditorError(null);
        setRichDocument(checked.data);
        setSerialized(serialize(checked.data));
      } else {
        setEditorError(checked.error.issues[0]?.message ?? "Lesson content exceeds an editor limit.");
        setSerialized(JSON.stringify({ version: 2, richContent: raw }));
      }
      setEditorRevision((value) => value + 1);
    },
    onSelectionUpdate() { setEditorRevision((value) => value + 1); },
  });
  void editorRevision;

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    serializedRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
    serializedRef.current?.click();
  }, [serialized]);
  useEffect(() => () => {
    for (const value of pendingRef.current.values()) URL.revokeObjectURL(value.url);
  }, []);

  const insertImage = (file: File) => {
    const pending = createPendingImage(file);
    if (!pending || !editor) return;
    editor.chain().focus(undefined, { scrollIntoView: false }).insertContent({ type: "image", attrs: { src: pending.value.url, uploadId: pending.uploadId, alt: "", caption: null, legacyId: pending.uploadId } }).run();
  };
  const dropImage = (event: DragEvent<HTMLDivElement>) => {
    const file = Array.from(event.dataTransfer.files).find((entry) => acceptedImageTypes.has(entry.type));
    if (!file || !editor) return;
    event.preventDefault();
    event.stopPropagation();
    const pending = createPendingImage(file);
    if (!pending) return;
    const canLocateDrop = typeof globalThis.document.elementFromPoint === "function";
    const position = canLocateDrop ? editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos : undefined;
    editor.chain().focus(undefined, { scrollIntoView: false }).insertContentAt(position ?? editor.state.selection.to, { type: "image", attrs: { src: pending.value.url, uploadId: pending.uploadId, alt: "", caption: null, legacyId: pending.uploadId } }).run();
  };
  const selectedImage = editor?.isActive("image") ? editor.getAttributes("image") : null;
  const activeUploadIds = new Set<string>();
  const nodes = [...richDocument.content] as RichTextNode[];
  while (nodes.length) {
    const node = nodes.pop()!;
    if (node.type === "image" && typeof node.attrs?.uploadId === "string") activeUploadIds.add(node.attrs.uploadId);
    if (node.content) nodes.push(...node.content);
  }

  return <div className="grid gap-4">
    <input data-form-dirty name="contentBlocks" ref={serializedRef} type="hidden" value={serialized} />
    {[...pendingMedia.entries()].filter(([uploadId]) => activeUploadIds.has(uploadId)).map(([uploadId, media]) => <input accept="image/png,image/jpeg,image/webp" className="sr-only" key={uploadId} name={`lessonFile.${uploadId}`} ref={(input) => assignPendingFile(input, media.file)} tabIndex={-1} type="file" />)}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="text-lg font-bold text-foreground">Lesson content</h3><p className="mt-1 text-sm text-muted">Write and format one continuous learner page. Images remain private managed assets.</p></div>
      <Dialog.Root>
        <Dialog.Trigger asChild><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:border-primary/40" type="button"><Eye aria-hidden className="size-4" />Preview</button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=closed]:opacity-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl focus:outline-none sm:p-8">
            <Dialog.Title className="pr-12 text-2xl font-bold text-foreground">Learner preview</Dialog.Title>
            <Dialog.Description className="mb-6 mt-2 text-sm text-muted">Current unsaved lesson content, including pending private images.</Dialog.Description>
            <Dialog.Close aria-label="Close preview" className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-subtle" type="button"><X aria-hidden className="size-5" /></Dialog.Close>
            <RichPreview document={richDocument} existingMedia={existingMedia} pendingMedia={pendingMedia} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
    {editorError ? <p className="rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm font-semibold text-destructive" role="alert">{editorError} Shorten or simplify the lesson before saving.</p> : null}
    <section aria-label="Lesson rich text editor" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {editor ? <RichToolbar editor={editor} onImage={() => pickerRef.current?.click()} /> : <div className="border-b border-border bg-subtle p-3 text-sm text-muted">Loading editor...</div>}
      <input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) insertImage(file); event.target.value = ""; }} ref={pickerRef} tabIndex={-1} type="file" />
      <div onDragOverCapture={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDropCapture={dropImage}><EditorContent editor={editor} /></div>
    </section>
    {selectedImage && editor ? <div className="grid gap-3 rounded-xl border border-border bg-subtle p-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold">Image alt text <span className="font-normal text-muted">Optional</span><input className="min-h-11 rounded-xl border border-border bg-surface px-3" maxLength={300} onChange={(event) => editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes("image", { alt: event.target.value }).run()} value={String(selectedImage.alt ?? "")} /></label>
      <label className="grid gap-2 text-sm font-semibold">Caption <span className="font-normal text-muted">Optional</span><input className="min-h-11 rounded-xl border border-border bg-surface px-3" maxLength={500} onChange={(event) => editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes("image", { caption: event.target.value || null }).run()} value={String(selectedImage.caption ?? "")} /></label>
    </div> : null}
    <p className="text-xs text-muted">Drop PNG, JPEG, or WebP files into the editor, or use Insert managed image. Upload validation runs again on save.</p>
  </div>;
}
