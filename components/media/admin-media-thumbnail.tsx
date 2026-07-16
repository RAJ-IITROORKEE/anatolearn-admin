/* eslint-disable @next/next/no-img-element -- Admin previews use short-lived signed URLs. */

import type { AdminMediaReference } from "@/features/media/service";

type Props = {
  attached?: boolean;
  label: string;
  legacyUrl?: string | null;
  media?: AdminMediaReference;
};

export function AdminMediaThumbnail({ attached = false, label, legacyUrl, media }: Props) {
  const source = media?.signedUrl ?? legacyUrl;
  const alt = media?.altText || label;
  return <div className="grid min-w-24 gap-1.5">
    <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-subtle">
      {source ? <img alt={alt} className="h-full w-full object-contain" src={source} /> : <span className="px-2 text-center text-xs text-muted">{attached ? "Preview unavailable" : "Not uploaded"}</span>}
    </div>
    <span className="text-center text-xs font-medium text-muted">{source ? `${label} attached` : attached ? `${label} preview unavailable` : `No ${label.toLowerCase()}`}</span>
  </div>;
}
