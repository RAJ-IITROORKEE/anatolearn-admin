import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { AdminMediaThumbnail } from "@/components/media/admin-media-thumbnail";
import { ResourceCard, ResourceCards, StatusBadge } from "@/components/phase3/admin-ui";
import { getAdminBySlug, listAdmin } from "@/components/phase3/data";
import { TopicForm } from "@/components/phase3/resource-forms";
import { EmptyState } from "@/components/shared/empty-state";
import { getAdminMediaMap } from "@/features/media/service";
import { createResource } from "../../../phase3-actions";

export default async function SystemTopicsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let system;
  try {
    system = await getAdminBySlug("organSystem", slug);
  } catch {
    notFound();
  }
  const result = await listAdmin("topic", { page: 1, pageSize: 100, organSystemId: system.id, sortBy: "displayOrder", sortOrder: "asc" });
  const media = await getAdminMediaMap(result.items.flatMap((item) => item.coverMediaId ? [item.coverMediaId] : []));

  return <>
    <PageHeader description={`Create and review topics belonging to ${system.name}.`} eyebrow="Organ systems" title={`${system.name} topics`} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
      <section><h2 className="mb-3 text-lg font-bold">Existing topics</h2>{result.items.length ? <ResourceCards>{result.items.map((item) => <ResourceCard actions={<StatusBadge status={item.status} />} href={`/organ-systems/${system.slug}/topics/${item.slug}`} key={item.id} title={item.title}><AdminMediaThumbnail attached={Boolean(item.coverMediaId)} label="Cover" legacyUrl={item.coverImageUrl} media={item.coverMediaId ? media.get(item.coverMediaId) : undefined} /><p className="mt-3">{item.summary || "No summary yet."}</p></ResourceCard>)}</ResourceCards> : <EmptyState action={{ href: "/topics/new", label: "Add topic" }} description={`Create the first topic for ${system.name}.`} title="No topics yet" />}</section>
      <section><h2 className="mb-3 text-lg font-bold">Add topic</h2><TopicForm action={createResource.bind(null, "topic")} systems={[{ id: system.id, label: system.name }]} /></section>
    </div>
  </>;
}
