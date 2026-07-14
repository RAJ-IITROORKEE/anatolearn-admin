import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { OrganSystemForm } from "@/components/phase3/resource-forms";
import { getAdmin } from "@/components/phase3/data";
import { changeResourceStatus, trashResourceAction, updateResource } from "../../phase3-actions";
export default async function OrganSystemPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; let item; try { item = await getAdmin("organSystem", id); } catch { notFound(); } return <><PageHeader action={<div className="flex flex-wrap gap-2"><StatusBadge status={item.status} />{item.status === "DRAFT" && <InlineAction action={changeResourceStatus.bind(null, "organSystem", id, "PUBLISHED")}>Publish</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={trashResourceAction.bind(null, "organ-system", id)} confirmMessage="This hides the organ system and its descendants from normal views. It can be restored from Settings > Trash for 30 days. Continue?">Delete</InlineAction>}</div>} description="Edit metadata and control publication. Publishing parents enables eligible child content." eyebrow="Organ systems" title={item.name} /><OrganSystemForm action={updateResource.bind(null, "organSystem", id)} item={item} /></>; }
