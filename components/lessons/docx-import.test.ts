import { beforeEach, expect, test, vi } from "vitest";

import { DOCX_MAX_BYTES, importDocxFile, normalizeImportedHtml } from "./docx-import";

const convertToHtml = vi.hoisted(() => vi.fn());
const imgElement = vi.hoisted(() => vi.fn((converter: unknown) => converter));

vi.mock("mammoth", () => ({
  default: {
    convertToHtml,
    images: { imgElement },
  },
}));

beforeEach(() => {
  convertToHtml.mockReset();
  imgElement.mockClear();
});

function docxContainer(...entrySizes: number[]) {
  const sizes = entrySizes.length ? entrySizes : [1];
  const directorySize = sizes.length * 46;
  const directoryEnd = 4 + directorySize;
  const bytes = new Uint8Array(directoryEnd + 22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  sizes.forEach((size, index) => {
    const offset = 4 + (index * 46);
    view.setUint32(offset, 0x02014b50, true);
    view.setUint32(offset + 24, size, true);
  });
  view.setUint32(directoryEnd, 0x06054b50, true);
  view.setUint16(directoryEnd + 8, sizes.length, true);
  view.setUint16(directoryEnd + 10, sizes.length, true);
  view.setUint32(directoryEnd + 12, directorySize, true);
  view.setUint32(directoryEnd + 16, 4, true);
  return bytes;
}

test("normalizes DOCX HTML to the editor allowlist", () => {
  const result = normalizeImportedHtml(`
    <script>alert(1)</script>
    <h1>Overview</h1>
    <h2>Blood flow</h2>
    <p><span style="font-weight: bold; font-style: italic">Left ventricle</span></p>
    <p><a href="https://example.com/heart">Safe</a> <a href="javascript:alert(1)">Unsafe</a></p>
    <ol><li>Fill</li><li>Pump</li></ol>
    <img src="data:image/png;base64,unsafe" alt="diagram">
  `);

  expect(result.html).toContain("<h2>Overview</h2>");
  expect(result.html).toContain("<h3>Blood flow</h3>");
  expect(result.html).toContain("<strong><em>Left ventricle</em></strong>");
  expect(result.html).toContain('<a href="https://example.com/heart">Safe</a>');
  expect(result.html).not.toContain("javascript:");
  expect(result.html).not.toContain("<script");
  expect(result.html).not.toContain("<img");
  expect(result.omittedImages).toBe(1);
});

test("rejects non-DOCX names, oversized files, and invalid ZIP signatures", async () => {
  await expect(importDocxFile(new File(["PK\u0003\u0004"], "lesson.txt"))).rejects.toThrow("Choose a .docx file");
  await expect(importDocxFile(new File([new Uint8Array(DOCX_MAX_BYTES + 1)], "lesson.docx"))).rejects.toThrow("10 MB or smaller");
  await expect(importDocxFile(new File(["not a zip"], "lesson.docx"))).rejects.toThrow("valid .docx");
  expect(convertToHtml).not.toHaveBeenCalled();
});

test("converts a valid DOCX locally and returns safe editor HTML", async () => {
  convertToHtml.mockResolvedValue({
    value: '<h1>Heart</h1><p><strong>Four chambers</strong></p><img src="docx-image:omitted">',
    messages: [{ type: "warning", message: "Unsupported shape" }],
  });
  const file = new File([docxContainer()], "heart.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const result = await importDocxFile(file);

  expect(convertToHtml).toHaveBeenCalledWith(
    { arrayBuffer: expect.any(ArrayBuffer) },
    expect.objectContaining({ externalFileAccess: false, includeEmbeddedStyleMap: false }),
  );
  expect(result.html).toBe("<h2>Heart</h2><p><strong>Four chambers</strong></p>");
  expect(result.messages).toEqual([
    "Embedded images were omitted. Add them with Insert managed image.",
    "Some DOCX formatting could not be imported. Review the lesson before saving.",
  ]);
});

test("rejects a DOCX with no importable lesson content", async () => {
  convertToHtml.mockResolvedValue({ value: "<img src=\"docx-image:omitted\">", messages: [] });
  const file = new File([docxContainer()], "images-only.docx");

  await expect(importDocxFile(file)).rejects.toThrow("does not contain importable text");
});

test("rejects DOCX archives with excessive expanded content", async () => {
  const file = new File([docxContainer(17 * 1024 * 1024, 17 * 1024 * 1024, 17 * 1024 * 1024)], "compressed-bomb.docx");

  await expect(importDocxFile(file)).rejects.toThrow("expands beyond the 50 MB safety limit");
  expect(convertToHtml).not.toHaveBeenCalled();
});
