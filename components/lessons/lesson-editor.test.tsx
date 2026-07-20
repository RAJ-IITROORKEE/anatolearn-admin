import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import type { ContentBlock } from "@/features/content/schemas";
import { LessonEditor } from "./lesson-editor";

const createObjectURL = vi.fn(() => "blob:lesson-image");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
});

function serialized(container: HTMLElement) {
  return JSON.parse((container.querySelector('input[name="contentBlocks"]') as HTMLInputElement).value) as {
    version: 2;
    richContent: { type: string; content: Array<Record<string, unknown>> };
    fallbackBlocks: ContentBlock[];
  };
}

test("loads all legacy lesson blocks losslessly into one true rich-text surface", () => {
  const mediaId = crypto.randomUUID();
  const blocks: ContentBlock[] = [
    { id: "heading", type: "heading", level: 2, text: "Heart" },
    { id: "paragraph", type: "paragraph", text: "Cardiac text" },
    { id: "image", type: "image", mediaId, altText: "Heart diagram", caption: "Anterior" },
    { id: "callout", type: "callout", tone: "info", title: "Remember", text: "Four chambers" },
    { id: "bullets", type: "bulletList", items: ["Atrium", "Ventricle"] },
    { id: "numbers", type: "numberedList", items: ["Fill", "Pump"] },
    { id: "divider", type: "divider" },
  ];
  const { container } = render(<LessonEditor existingMedia={{ [mediaId]: { signedUrl: "https://signed.test/heart", altText: "Stored heart" } }} initialBlocks={blocks} />);

  expect(screen.getByRole("textbox", { name: "Lesson rich text editor" })).toBeVisible();
  expect(screen.queryByTestId("lesson-block")).not.toBeInTheDocument();
  expect(serialized(container).fallbackBlocks).toEqual(blocks);
  expect(screen.getByRole("img", { name: "Heart diagram" })).toHaveAttribute("src", "https://signed.test/heart");
});

test("does not mark existing content changed until an explicit editor action", async () => {
  const onInteraction = vi.fn();
  render(<form onClick={(event) => { if ((event.target as Element).closest("[data-form-dirty]")) onInteraction(); }}><LessonEditor initialBlocks={[{ type: "paragraph", text: "Existing deterministic lesson" }]} /></form>);

  await waitFor(() => expect(screen.getByRole("textbox", { name: "Lesson rich text editor" })).toBeVisible());
  expect(onInteraction).not.toHaveBeenCalled();

  fireEvent.focus(screen.getByRole("textbox", { name: "Lesson rich text editor" }));
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Lesson rich text editor" }), { key: "a", code: "KeyA", ctrlKey: true });
  await userEvent.setup().click(screen.getByRole("button", { name: "Bold" }));
  await waitFor(() => expect(onInteraction).toHaveBeenCalled());
});

test("persists toolbar formatting in the strict rich AST and compatible text fallback", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Cardiac anatomy" }]} />);
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });

  fireEvent.focus(editor);
  fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
  await user.click(screen.getByRole("button", { name: "Bold" }));
  await user.click(screen.getByRole("button", { name: "Underline" }));
  await user.selectOptions(screen.getByRole("combobox", { name: "Font size" }), "20px");
  await user.click(screen.getByRole("button", { name: "Align center" }));

  await waitFor(() => {
    const value = serialized(container);
    expect(value.fallbackBlocks).toEqual([{ type: "paragraph", text: "Cardiac anatomy" }]);
    expect(JSON.stringify(value.richContent)).toContain('"type":"bold"');
    expect(JSON.stringify(value.richContent)).toContain('"type":"underline"');
    expect(JSON.stringify(value.richContent)).toContain('"fontSize":"20px"');
    expect(JSON.stringify(value.richContent)).toContain('"textAlign":"center"');
  });
});

test("offers named text colors with visible swatches", async () => {
  const user = userEvent.setup();
  render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Cardiac anatomy" }]} />);

  await user.click(screen.getByRole("button", { name: "Text color" }));
  const menu = screen.getByRole("menu");
  const choices = [
    ["Strong text", "#0F172A"], ["Slate", "#334155"], ["Blue", "#2563EB"],
    ["Purple", "#7C3AED"], ["Red", "#DC2626"], ["Orange", "#C2410C"],
    ["Amber", "#A16207"], ["Green", "#16A34A"], ["Teal", "#0F766E"],
    ["Pink", "#BE185D"],
  ] as const;

  expect(within(menu).getByRole("menuitem", { name: "Default text" })).toBeVisible();
  for (const [name, color] of choices) {
    const option = within(menu).getByRole("menuitem", { name });
    expect(option).toBeVisible();
    expect(option.querySelector("[data-color-swatch]")).toHaveStyle({ backgroundColor: color });
  }
});

test("offers named highlight colors with visible swatches", async () => {
  const user = userEvent.setup();
  render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Cardiac anatomy" }]} />);

  await user.click(screen.getByRole("button", { name: "Highlight color" }));
  const menu = screen.getByRole("menu");
  const choices = [
    ["Neutral", "#F1F5F9"], ["Blue", "#DBEAFE"], ["Purple", "#EDE9FE"],
    ["Red", "#FEE2E2"], ["Orange", "#FFEDD5"], ["Amber", "#FEF3C7"],
    ["Green", "#DCFCE7"], ["Teal", "#CCFBF1"], ["Pink", "#FCE7F3"],
  ] as const;

  expect(within(menu).getByRole("menuitem", { name: "No highlight" })).toBeVisible();
  for (const [name, color] of choices) {
    const option = within(menu).getByRole("menuitem", { name });
    expect(option).toBeVisible();
    expect(option.querySelector("[data-color-swatch]")).toHaveStyle({ backgroundColor: color });
  }
});

test("applies and clears allowlisted text and highlight colors", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Cardiac anatomy" }]} />);
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });

  fireEvent.focus(editor);
  fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
  await user.click(screen.getByRole("button", { name: "Text color" }));
  await user.click(screen.getByRole("menuitem", { name: "Teal" }));
  await waitFor(() => expect(JSON.stringify(serialized(container).richContent)).toContain('"color":"#0F766E"'));

  await user.click(screen.getByRole("button", { name: "Text color" }));
  await user.click(screen.getByRole("menuitem", { name: "Default text" }));
  await waitFor(() => expect(JSON.stringify(serialized(container).richContent)).not.toContain('"color"'));

  await user.click(screen.getByRole("button", { name: "Highlight color" }));
  await user.click(screen.getByRole("menuitem", { name: "Amber" }));
  await waitFor(() => expect(JSON.stringify(serialized(container).richContent)).toContain('"color":"#FEF3C7"'));

  await user.click(screen.getByRole("button", { name: "Highlight color" }));
  await user.click(screen.getByRole("menuitem", { name: "No highlight" }));
  await waitFor(() => expect(JSON.stringify(serialized(container).richContent)).not.toContain('"highlight"'));
});

test("opens the color choices and applies a swatch from the keyboard", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Cardiac anatomy" }]} />);
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });
  const trigger = screen.getByRole("button", { name: "Text color" });

  fireEvent.focus(editor);
  fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("menu", { name: "Text color" })).toBeVisible();
  await user.keyboard("{End}{Enter}");

  await waitFor(() => expect(JSON.stringify(serialized(container).richContent)).toContain('"color":"#BE185D"'));
  expect(editor).toHaveFocus();
  expect(trigger).toHaveTextContent("Pink");
});

test("does not duplicate legacy IDs when Enter splits a legacy paragraph", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ id: "stable-paragraph", type: "paragraph", text: "Cardiac anatomy" }]} />);
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });

  fireEvent.focus(editor);
  await user.keyboard("{End}{Enter}");

  await waitFor(() => {
    const ids = serialized(container).richContent.content.flatMap((node) => {
      const id = (node.attrs as { legacyId?: string } | undefined)?.legacyId;
      return id ? [id] : [];
    });
    expect(ids).toEqual(["stable-paragraph"]);
  });
});

test("normalizes duplicate legacy IDs introduced by copy and paste", async () => {
  const user = userEvent.setup();
  const { container } = render(<LessonEditor initialBlocks={[{ id: "copied-paragraph", type: "paragraph", text: "Copy me" }]} />);
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });

  fireEvent.focus(editor);
  fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
  await user.keyboard("{Control>}c{/Control}{End}{Enter}{Control>}v{/Control}");

  await waitFor(() => {
    const ids = serialized(container).richContent.content.flatMap((node) => {
      const id = (node.attrs as { legacyId?: string } | undefined)?.legacyId;
      return id ? [id] : [];
    });
    expect(new Set(ids).size).toBe(ids.length);
  });
});

test("offers only allowlisted editor controls and no raw import or table surface", () => {
  render(<LessonEditor initialBlocks={[]} />);

  for (const name of ["Paragraph", "Heading 2", "Heading 3", "Heading 4", "Bold", "Italic", "Underline", "Strike", "Bulleted list", "Ordered list", "Block quote", "Add link", "Undo", "Redo", "Insert managed image"]) {
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  }
  expect(screen.queryByRole("button", { name: /table|html|docx|url image/i })).not.toBeInTheDocument();
});

test("drops a managed image using a stable multipart name without serializing its blob URL", async () => {
  const { container } = render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Before image" }]} />);
  const file = new File(["image"], "heart.webp", { type: "image/webp" });

  fireEvent.drop(screen.getByRole("textbox", { name: "Lesson rich text editor" }), {
    dataTransfer: { files: [file], types: ["Files"] },
  });

  await waitFor(() => expect(container.querySelector('input[type="file"][name^="lessonFile."]')).toBeInTheDocument());
  const value = serialized(container);
  const image = value.richContent.content.find((node) => node.type === "image") as { attrs: { uploadId: string; src?: string } };
  expect(image.attrs.uploadId).toMatch(/^[0-9a-f-]{36}$/);
  expect(image.attrs).not.toHaveProperty("src");
  expect(container.querySelector(`input[name="lessonFile.${image.attrs.uploadId}"]`)).toBeInTheDocument();
});

test("submits only pending image files still referenced by the rich document", async () => {
  const user = userEvent.setup();
  const submitted = vi.fn();
  const { container } = render(
    <form onSubmit={(event) => { event.preventDefault(); submitted(new FormData(event.currentTarget)); }}>
      <LessonEditor initialBlocks={[{ type: "paragraph", text: "Keep active images" }]} />
      <button type="submit">Save lesson</button>
    </form>,
  );
  const picker = container.querySelector('section input[type="file"]:not([name])') as HTMLInputElement;
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });

  await user.upload(picker, new File(["first"], "first.png", { type: "image/png" }));
  fireEvent.keyDown(editor, { key: "ArrowLeft", code: "ArrowLeft" });
  await user.upload(picker, new File(["second"], "second.png", { type: "image/png" }));

  await waitFor(() => {
    expect(container.querySelectorAll('input[name^="lessonFile."]')).toHaveLength(2);
    expect(serialized(container).richContent.content.filter((node) => node.type === "image")).toHaveLength(2);
  });
  const beforeRemoval = serialized(container).richContent.content.filter((node) => node.type === "image") as Array<{ attrs: { uploadId: string } }>;
  const removedUploadId = beforeRemoval[1].attrs.uploadId;
  const activeUploadId = beforeRemoval[0].attrs.uploadId;
  const editorImages = container.querySelectorAll(".ProseMirror img");
  const elementFromPoint = document.elementFromPoint;
  const rangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;
  const rangeGetClientRects = Range.prototype.getClientRects;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => editorImages[1] });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });

  await new Promise((resolve) => setTimeout(resolve, 550));
  await user.click(editorImages[1]);
  fireEvent.keyDown(editor, { key: "Backspace", code: "Backspace" });

  await waitFor(() => {
    expect(container.querySelector(`input[name="lessonFile.${removedUploadId}"]`)).not.toBeInTheDocument();
    expect(container.querySelector(`input[name="lessonFile.${activeUploadId}"]`)).toBeInTheDocument();
  });
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: elementFromPoint });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: rangeGetBoundingClientRect });
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: rangeGetClientRects });
  await user.click(screen.getByRole("button", { name: "Save lesson" }));

  const data = submitted.mock.calls[0][0] as FormData;
  expect(data.has(`lessonFile.${removedUploadId}`)).toBe(false);
  expect(data.has(`lessonFile.${activeUploadId}`)).toBe(true);
  expect(revokeObjectURL).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(container.querySelector(`input[name="lessonFile.${removedUploadId}"]`)).toBeInTheDocument());
});

test("shows current text and pending managed images in the accessible top preview dialog", async () => {
  const user = userEvent.setup();
  render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Learner preview copy" }]} />);
  fireEvent.drop(screen.getByRole("textbox", { name: "Lesson rich text editor" }), {
    dataTransfer: { files: [new File(["image"], "heart.png", { type: "image/png" })], types: ["Files"] },
  });

  const preview = screen.getByRole("button", { name: "Preview" });
  expect(preview).toHaveClass("bg-primary", "text-white");
  await user.click(preview);
  const dialog = screen.getByRole("dialog", { name: "Learner preview" });
  expect(dialog).toHaveTextContent("Learner preview copy");
  expect(dialog.querySelector("img")).toHaveAttribute("src", "blob:lesson-image");
});

test("keeps only the formatting toolbar sticky beneath the app header", () => {
  render(<LessonEditor initialBlocks={[{ type: "paragraph", text: "Cardiac anatomy" }]} />);

  const toolbar = screen.getByRole("toolbar", { name: "Rich text formatting" });
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });
  const heading = screen.getByRole("heading", { name: "Lesson content" });

  expect(toolbar).toHaveClass("sticky", "top-16");
  expect(toolbar).toHaveClass("flex-nowrap", "overflow-x-auto", "[&>*]:shrink-0", "min-w-0", "max-w-full");
  expect(toolbar.closest("section")).not.toHaveClass("overflow-hidden");
  expect(toolbar.closest("section")).toHaveClass("min-w-0", "max-w-full");
  expect(toolbar.closest("section")?.parentElement).toHaveClass("min-w-0", "max-w-full");
  expect(editor).not.toHaveClass("sticky");
  expect(heading.parentElement).not.toHaveClass("sticky");
});

test("revokes pending image object URLs only when replaced or unmounted", async () => {
  const { unmount } = render(<LessonEditor initialBlocks={[]} />);
  const editor = screen.getByRole("textbox", { name: "Lesson rich text editor" });
  fireEvent.drop(editor, { dataTransfer: { files: [new File(["one"], "one.png", { type: "image/png" })], types: ["Files"] } });
  fireEvent.drop(editor, { dataTransfer: { files: [new File(["two"], "two.png", { type: "image/png" })], types: ["Files"] } });

  expect(revokeObjectURL).not.toHaveBeenCalled();
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledTimes(2);
});
