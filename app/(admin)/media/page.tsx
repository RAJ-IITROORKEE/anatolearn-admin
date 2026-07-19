import type { Metadata } from "next";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import {
  FilterBar,
  fieldClass,
} from "@/components/phase3/admin-ui";
import { listMedia } from "@/features/media/service";
import { mediaListSchema } from "@/features/media/schemas";
import { MediaLibrary } from "@/components/media/media-library";
import { UploadMediaDialog } from "@/components/media/upload-media-form";

export const metadata: Metadata = { title: "Media library" };
import {
  trashMediaAction,
  updateMediaAction,
  uploadMediaAction,
} from "../phase3-actions";
export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = mediaListSchema.safeParse({
    page: params.page,
    pageSize: 12,
    search: params.q || undefined,
    mimeType: params.mimeType || undefined,
    archived: params.archived || "false",
  });
  const input = parsed.success
    ? parsed.data
    : mediaListSchema.parse({ pageSize: 12, archived: "false" });
  const result = await listMedia(input);
  return (
    <>
      <PageHeader
        action={<UploadMediaDialog action={uploadMediaAction} />}
        description="Upload private anatomy imagery, maintain accessible descriptions, and archive unused assets."
        eyebrow="Assets"
        title="Media library"
      />
      <FilterBar defaultValue={input.search} placeholder="Search filenames or alt text">
        <select aria-label="Status" className={fieldClass} defaultValue={input.archived === true ? "true" : "false"} name="archived">
          <option value="false">Current media</option>
          <option value="true">Archived media</option>
        </select>
      </FilterBar>
      {result.items.length
        ? <MediaLibrary items={result.items} trashAction={trashMediaAction} updateAction={updateMediaAction} />
        : <EmptyState description="Upload the first image or change the current filters." title="No media found" />}
      <div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/media" /></div>
    </>
  );
}
