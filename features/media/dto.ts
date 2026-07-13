type MediaAssetDtoSource = {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: bigint;
  width: number | null;
  height: number | null;
  altText: string;
  archivedAt: Date | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
};

export function mediaDto(
  asset: MediaAssetDtoSource,
  signedUrl: string | null,
  signedUrlExpiresIn: number | null,
) {
  return {
    ...asset,
    byteSize: asset.byteSize.toString(10),
    signedUrl,
    signedUrlExpiresIn,
  };
}
