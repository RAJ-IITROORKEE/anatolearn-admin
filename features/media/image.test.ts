import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { inspectImage } from "./image";

describe("inspectImage", () => {
  it.each([
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
  ] as const)("fully decodes valid %s images", async (format, mimeType) => {
    const bytes = await sharp({ create: { width: 6, height: 4, channels: 3, background: "red" } })[format]().toBuffer();
    await expect(inspectImage(bytes)).resolves.toEqual({ mimeType, width: 6, height: 4 });
  });

  it("rejects a fabricated PNG header without image content", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
    new DataView(bytes.buffer).setUint32(16, 640);
    new DataView(bytes.buffer).setUint32(20, 480);

    await expect(inspectImage(bytes)).rejects.toThrow("Unsupported or malformed image");
  });

  it("rejects truncated encoded images", async () => {
    const complete = await sharp({ create: { width: 20, height: 20, channels: 3, background: "blue" } }).png().toBuffer();
    await expect(inspectImage(complete.subarray(0, 40))).rejects.toThrow("Unsupported or malformed image");
  });

  it("rejects valid images exceeding the dimension limit", async () => {
    const bytes = await sharp({ create: { width: 12_001, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    await expect(inspectImage(bytes)).rejects.toThrow("Unsupported or malformed image");
  });
});
