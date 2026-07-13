import { PageHeader } from "@/components/app-shell/page-header";
import { LessonForm } from "@/components/phase3/resource-forms";
import { listAdmin } from "@/components/phase3/data";
import { createResource } from "../../phase3-actions";
export default async function NewContentPage() { const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" }); return <><PageHeader description="Build a safe structured lesson. Save it as a draft before publication." eyebrow="Content review" title="Create lesson" /><LessonForm action={createResource.bind(null, "contentLesson")} topics={topics.items.map((item) => ({ id: item.id, label: item.title }))} /></>; }
