import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ActionForm, InlineAction } from "@/components/phase3/action-form";
import {
  FilterBar,
  StatusBadge,
  fieldClass,
  labelClass,
  panelClass,
} from "@/components/phase3/admin-ui";
import { listMedia } from "@/features/media/service";
import { mediaListSchema } from "@/features/media/schemas";
import {
  archiveMediaAction,
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
    archived: params.archived || undefined,
  });
  const input = parsed.success
    ? parsed.data
    : mediaListSchema.parse({ pageSize: 12 });
  const result = await listMedia(input);
  return (
    <>
      <PageHeader
        description="Upload private anatomy imagery, maintain accessible descriptions, and archive unused assets."
        eyebrow="Assets"
        title="Media library"
      />
      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <FilterBar
            defaultValue={input.search}
            placeholder="Search filenames or alt text"
          >
            <select
              aria-label="Archive state"
              className={fieldClass}
              defaultValue={params.archived ?? "false"}
              name="archived"
            >
              <option value="false">Current media</option>
              <option value="true">Archived media</option>
            </select>
          </FilterBar>
          {result.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {result.items.map((item) => (
                <article className={panelClass} key={item.id}>
                  <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-subtle">
                    {item.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={item.altText}
                        className="h-full w-full object-contain"
                        src={item.signedUrl}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-muted" role="status">
                        Preview temporarily unavailable
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="break-all text-sm font-bold">
                      {item.originalFilename}
                    </h2>
                    <StatusBadge
                      status={item.archivedAt ? "ARCHIVED" : "ACTIVE"}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {item.mimeType} · {item.width ?? "?"}×{item.height ?? "?"} ·{" "}
                    {Math.ceil(Number(item.byteSize) / 1024)} KB
                  </p>
                  <ActionForm
                    action={updateMediaAction.bind(null, item.id)}
                    label="Update alt text"
                  >
                    <label className={`${labelClass} mt-4`}>
                      Alt text
                      <textarea
                        className={`${fieldClass} min-h-20 py-2`}
                        defaultValue={item.altText}
                        name="altText"
                        required
                      />
                    </label>
                  </ActionForm>
                  {!item.archivedAt && (
                    <div className="mt-3">
                      <InlineAction
                        action={archiveMediaAction.bind(null, item.id)}
                        confirmMessage="Archive this media asset?"
                      >
                        Archive
                      </InlineAction>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Upload the first image or change the current filters."
              title="No media found"
            />
          )}
          <div className="mt-5">
            <Pagination
              page={result.pagination.page}
              pageCount={Math.max(1, result.pagination.totalPages)}
              pathname="/media"
            />
          </div>
        </section>
        <aside>
          <h2 className="mb-3 text-lg font-bold">Upload image</h2>
          <div className={panelClass}>
            <ActionForm
              action={uploadMediaAction}
              label="Upload image"
              pendingLabel="Uploading"
            >
              <label className={labelClass}>
                Image file
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className={`${fieldClass} py-2`}
                  name="file"
                  required
                  type="file"
                />
              </label>
              <label className={labelClass}>
                Alt text
                <textarea
                  className={`${fieldClass} min-h-24 py-3`}
                  maxLength={500}
                  name="altText"
                  required
                />
              </label>
              <p className="text-xs leading-5 text-muted">
                PNG, JPEG, or WebP. The server verifies image contents and
                configured size limits.
              </p>
            </ActionForm>
          </div>
        </aside>
      </div>
    </>
  );
}
