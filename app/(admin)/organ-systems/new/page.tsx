import { PageHeader } from "@/components/app-shell/page-header";
import { OrganSystemForm } from "@/components/phase3/resource-forms";
import { createResource } from "../../phase3-actions";
export default function NewOrganSystemPage() { return <><PageHeader description="Define the curriculum label, descriptions, media references, and display order." eyebrow="Organ systems" title="Add organ system" /><OrganSystemForm action={createResource.bind(null, "organSystem")} /></>; }
