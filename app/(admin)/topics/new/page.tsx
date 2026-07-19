import { PageHeader } from "@/components/app-shell/page-header";
import { listAdmin } from "@/components/phase3/data";
import { TopicForm } from "@/components/phase3/resource-forms";
import { createResource } from "../../phase3-actions";

export default async function NewTopicPage() {
  const systems = await listAdmin("organSystem", { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" });
  return <>
    <PageHeader description="Choose an organ system, then define the topic details, cover, and curriculum order." eyebrow="Topics" title="Add topic" />
    <TopicForm action={createResource.bind(null, "topic")} systems={systems.items.map((system) => ({ id: system.id, label: system.name }))} />
  </>;
}
