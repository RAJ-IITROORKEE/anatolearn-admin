ALTER TABLE "MediaAsset"
  DROP CONSTRAINT "MediaAsset_metadata_check";

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_metadata_check"
  CHECK (
    "byteSize" > 0
    AND (("width" IS NULL AND "height" IS NULL) OR ("width" > 0 AND "height" > 0))
  );
