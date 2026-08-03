"use client";

export const DOCX_MAX_BYTES = 10 * 1024 * 1024;
const DOCX_MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
const DOCX_MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const DOCX_MAX_ENTRIES = 2_000;

type NormalizedImport = {
  html: string;
  omittedImages: number;
};

type DocxImportResult = {
  html: string;
  messages: string[];
};

const skippedElements = new Set(["head", "meta", "link", "script", "style", "noscript", "iframe", "object", "embed", "svg", "canvas"]);
const supportedElements = new Set(["p", "blockquote", "ul", "ol", "li", "hr"]);

function readBlob(blob: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

function validateArchive(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error("Choose a valid .docx file.");

  let directoryEnd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      directoryEnd = offset;
      break;
    }
  }
  if (directoryEnd < 0) throw new Error("Choose a valid .docx file.");

  const entryCount = view.getUint16(directoryEnd + 10, true);
  const directorySize = view.getUint32(directoryEnd + 12, true);
  const directoryOffset = view.getUint32(directoryEnd + 16, true);
  if (entryCount > DOCX_MAX_ENTRIES || entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new Error("This DOCX contains too many archive entries to import safely.");
  }
  if (directoryOffset + directorySize > directoryEnd) throw new Error("Choose a valid .docx file.");

  let offset = directoryOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Choose a valid .docx file.");
    const entryBytes = view.getUint32(offset + 24, true);
    if (entryBytes === 0xffffffff || entryBytes > DOCX_MAX_ENTRY_BYTES) {
      throw new Error("This DOCX contains an archive entry that is too large to import safely.");
    }
    expandedBytes += entryBytes;
    if (expandedBytes > DOCX_MAX_EXPANDED_BYTES) throw new Error("This DOCX expands beyond the 50 MB safety limit.");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset !== directoryOffset + directorySize) throw new Error("Choose a valid .docx file.");
}

function safeHref(value: string) {
  const href = value.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

function styleMarks(element: Element) {
  const style = element.getAttribute("style")?.toLowerCase() ?? "";
  const weight = /font-weight\s*:\s*([^;]+)/.exec(style)?.[1]?.trim() ?? "";
  const decoration = /text-decoration(?:-line)?\s*:\s*([^;]+)/.exec(style)?.[1] ?? "";
  return {
    bold: weight === "bold" || Number.parseInt(weight, 10) >= 600,
    italic: /font-style\s*:\s*(italic|oblique)/.test(style),
    strike: decoration.includes("line-through"),
    underline: decoration.includes("underline"),
  };
}

export function normalizeImportedHtml(html: string): NormalizedImport {
  const source = new DOMParser().parseFromString(html, "text/html");
  const output = document.createElement("div");
  let omittedImages = 0;

  const appendNode = (node: Node, target: Node) => {
    if (node.nodeType === 3) {
      target.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (!(node instanceof Element)) return;

    const tag = node.tagName.toLowerCase();
    if (skippedElements.has(tag)) return;
    if (tag === "img") {
      omittedImages += 1;
      return;
    }
    if (tag === "br") {
      target.appendChild(document.createTextNode(" "));
      return;
    }

    let destination: Node = document.createDocumentFragment();
    let element: HTMLElement | null = null;
    if (/^h[1-6]$/.test(tag)) {
      const sourceLevel = Number(tag.slice(1));
      element = document.createElement(`h${Math.min(sourceLevel + 1, 4)}`);
    } else if (supportedElements.has(tag)) {
      element = document.createElement(tag);
    } else if (["strong", "b"].includes(tag)) {
      element = document.createElement("strong");
    } else if (["em", "i"].includes(tag)) {
      element = document.createElement("em");
    } else if (tag === "u") {
      element = document.createElement("u");
    } else if (["s", "strike", "del"].includes(tag)) {
      element = document.createElement("s");
    } else if (tag === "a") {
      const href = safeHref(node.getAttribute("href") ?? "");
      if (href) {
        element = document.createElement("a");
        element.setAttribute("href", href);
      }
    }
    if (element) destination = element;

    for (const child of Array.from(node.childNodes)) appendNode(child, destination);

    if (tag === "span") {
      const marks = styleMarks(node);
      for (const [enabled, mark] of [[marks.italic, "em"], [marks.bold, "strong"], [marks.underline, "u"], [marks.strike, "s"]] as const) {
        if (!enabled) continue;
        const wrapper = document.createElement(mark);
        wrapper.appendChild(destination);
        destination = wrapper;
      }
    }
    target.appendChild(destination);
  };

  for (const child of Array.from(source.body.childNodes)) appendNode(child, output);
  return { html: output.innerHTML.trim(), omittedImages };
}

export async function importDocxFile(file: File): Promise<DocxImportResult> {
  if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("Choose a .docx file.");
  if (file.size > DOCX_MAX_BYTES) throw new Error("Choose a DOCX file that is 10 MB or smaller.");

  const arrayBuffer = await readBlob(file);
  validateArchive(arrayBuffer);

  const mammoth = (await import("mammoth")).default;
  const converted = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async () => ({ src: "docx-image:omitted" })),
      externalFileAccess: false,
      includeEmbeddedStyleMap: false,
      styleMap: ["u => u"],
    },
  );
  const normalized = normalizeImportedHtml(converted.value);
  const text = new DOMParser().parseFromString(normalized.html, "text/html").body.textContent?.trim();
  if (!text) throw new Error("This DOCX does not contain importable text.");

  const messages: string[] = [];
  if (normalized.omittedImages) messages.push("Embedded images were omitted. Add them with Insert managed image.");
  if (converted.messages.length) messages.push("Some DOCX formatting could not be imported. Review the lesson before saving.");
  return { html: normalized.html, messages };
}
