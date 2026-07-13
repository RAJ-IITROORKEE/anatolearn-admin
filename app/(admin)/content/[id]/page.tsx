import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { LessonForm } from "@/components/phase3/resource-forms";
import { getAdmin, listAdmin } from "@/components/phase3/data";
import { changeResourceStatus, updateResource } from "../../phase3-actions";
export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; let item; try { item = await getAdmin("contentLesson", id); } catch { notFound(); } const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" }); return <><PageHeader action={<div className="flex flex-wrap gap-2"><StatusBadge status={item.status} />{item.status === "DRAFT" && <InlineAction action={changeResourceStatus.bind(null, "contentLesson", id, "PUBLISHED")}>Publish</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={changeResourceStatus.bind(null, "contentLesson", id, "ARCHIVED")} confirmMessage="Archive this lesson?">Archive</InlineAction>}</div>} description="Edit validated blocks and control the lesson publication lifecycle." eyebrow="Content review" title={item.title} /><LessonForm action={updateResource.bind(null, "contentLesson", id)} item={item} topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} /></>; }
