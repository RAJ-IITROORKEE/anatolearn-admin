import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { TopicForm } from "@/components/phase3/resource-forms";
import { getAdmin, listAdmin } from "@/components/phase3/data";
import { changeResourceStatus, updateResource } from "../../phase3-actions";
export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; let item; try { item = await getAdmin("topic", id); } catch { notFound(); } const systems = await listAdmin("organSystem", { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" }); return <><PageHeader action={<div className="flex flex-wrap gap-2"><StatusBadge status={item.status} />{item.status === "DRAFT" && <InlineAction action={changeResourceStatus.bind(null, "topic", id, "PUBLISHED")}>Publish</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={changeResourceStatus.bind(null, "topic", id, "ARCHIVED")} confirmMessage="Archive this topic?">Archive</InlineAction>}</div>} description="Edit the topic and its place in the anatomy curriculum." eyebrow="Topics" title={item.title} /><TopicForm action={updateResource.bind(null, "topic", id)} item={item} systems={systems.items.map((system) => ({ id: system.id, label: system.name }))} /></>; }
