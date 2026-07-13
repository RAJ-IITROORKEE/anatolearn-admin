import sharp from "sharp";

export type ImageInfo = { mimeType: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };

const MAX_IMAGE_DIMENSION = 12_000;
const MAX_IMAGE_PIXELS = 40_000_000;

export async function inspectImage(bytes: Uint8Array): Promise<ImageInfo> {
  try {
    const image = sharp(bytes, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true });
    const metadata = await image.metadata();
    const mimeType = metadata.format === "png"
      ? "image/png"
      : metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "webp"
          ? "image/webp"
          : null;
    if (!mimeType || !metadata.width || !metadata.height) throw new Error("Unsupported image format.");
    if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw new Error("Image dimensions are too large.");
    }

    // Metadata parsing alone can accept a valid header with missing pixel data.
    await image.clone().raw().toBuffer();
    return { mimeType, width: metadata.width, height: metadata.height };
  } catch {
    throw new Error("Unsupported or malformed image.");
  }
}
