import type { ContentBlock, RichTextDocument } from "@/features/content/schemas";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { DirectImageInput } from "@/components/media/direct-image-input";
import { ActionForm, type FormAction } from "./action-form";
import { fieldClass, labelClass, panelClass } from "./admin-ui";

type System = { name: string; slug: string; shortDescription: string; longDescription?: string | null; coverMediaId?: string | null; iconMediaId?: string | null; displayOrder: number; isActive: boolean };
type Topic = { organSystemId: string; title: string; slug: string; summary?: string | null; coverMediaId?: string | null; displayOrder: number };
type Lesson = { topicId: string; title: string; slug: string; summary?: string | null; contentBlocks: ContentBlock[]; richContent?: RichTextDocument; estimatedReadingMinutes: number; displayOrder: number };
type Option = { id: string; label: string };
type MediaPreview = { signedUrl: string; altText: string };
type ExistingLessonMedia = Record<string, MediaPreview>;

function FormSection({ children, description, title }: { children: React.ReactNode; description?: string; title: string }) {
  return <section className="grid gap-5 border-b border-border pb-6 last:border-b-0 last:pb-0"><div><h2 className="text-lg font-bold text-foreground">{title}</h2>{description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}</div>{children}</section>;
}

export function OrganSystemForm({ action, item, coverMedia, iconMedia }: { action: FormAction; item?: System; coverMedia?: MediaPreview; iconMedia?: MediaPreview }) {
  return <div className={panelClass}><ActionForm action={action} label={item ? "Save organ system" : "Create organ system"}>
    <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Name<input className={fieldClass} defaultValue={item?.name} name="name" required /></label><label className={labelClass}>Slug<span className="mb-1 block text-xs font-normal text-muted">Optional. Generated from the name when blank.</span><input className={fieldClass} defaultValue={item?.slug} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label></div>
    <label className={labelClass}>Short description<textarea className={`${fieldClass} min-h-24 py-3`} defaultValue={item?.shortDescription} name="shortDescription" required /></label>
    <label className={labelClass}>Long description<textarea className={`${fieldClass} min-h-36 py-3`} defaultValue={item?.longDescription ?? ""} name="longDescription" /></label>
    <div className="grid gap-5 lg:grid-cols-2"><DirectImageInput altTextName="coverAltText" clearName="clearCover" existingAltText={coverMedia?.altText} existingMediaId={item?.coverMediaId} existingPreviewUrl={coverMedia?.signedUrl} fileName="coverFile" label="Cover image" mediaIdName="coverMediaId" /><DirectImageInput altTextName="iconAltText" clearName="clearIcon" existingAltText={iconMedia?.altText} existingMediaId={item?.iconMediaId} existingPreviewUrl={iconMedia?.signedUrl} fileName="iconFile" label="Icon image" mediaIdName="iconMediaId" /></div>
    <label className={labelClass}>Display order<input className={fieldClass} defaultValue={item?.displayOrder ?? 0} min="0" name="displayOrder" required type="number" /></label>
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-body"><input defaultChecked={item?.isActive ?? true} name="isActive" type="checkbox" />Active and selectable when published</label>
  </ActionForm></div>;
}

export function TopicForm({ action, item, systems, coverMedia }: { action: FormAction; item?: Topic; systems: Option[]; coverMedia?: MediaPreview }) {
  return <div className={panelClass}><ActionForm action={action} label={item ? "Save topic" : "Create topic"} stickyActions>
    <FormSection description="Choose where this topic appears and define its readable admin URL." title="Topic details">
      <label className={labelClass}>Organ system<select className={fieldClass} defaultValue={item?.organSystemId} name="organSystemId" required><option value="">Select an organ system</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.label}</option>)}</select></label>
      <div className="grid gap-5 md:grid-cols-2"><label className={labelClass}>Title<input className={fieldClass} defaultValue={item?.title} name="title" required /></label><label className={labelClass}>Slug<input className={fieldClass} defaultValue={item?.slug} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label></div>
      <label className={labelClass}>Summary<textarea className={`${fieldClass} min-h-28 py-3`} defaultValue={item?.summary ?? ""} name="summary" /></label>
    </FormSection>
    <FormSection description="A compact preview is shown here; full image validation still happens securely on save." title="Cover image">
      <DirectImageInput altTextName="coverAltText" clearName="clearCover" existingAltText={coverMedia?.altText} existingMediaId={item?.coverMediaId} existingPreviewUrl={coverMedia?.signedUrl} fileName="coverFile" label="Topic cover" mediaIdName="coverMediaId" />
    </FormSection>
    <FormSection title="Ordering"><label className={`${labelClass} max-w-xs`}>Display order<input className={fieldClass} defaultValue={item?.displayOrder ?? 0} min="0" name="displayOrder" required type="number" /></label></FormSection>
  </ActionForm></div>;
}

export function LessonForm({ action, item, topics, existingMedia = {} }: { action: FormAction; item?: Lesson; topics: Option[]; existingMedia?: ExistingLessonMedia }) {
  const initialBlocks: ContentBlock[] = item?.contentBlocks ?? [{ type: "heading", level: 2, text: "Overview" }, { type: "paragraph", text: "Add lesson text here." }];
  return <div className={panelClass}><ActionForm action={action} guardUnsavedChanges="lesson" label={item ? "Save draft changes" : "Create lesson"} stickyActions>
    <FormSection description="Set the curriculum location and learner-facing identity." title="Lesson details">
      <label className={labelClass}>Topic<select className={fieldClass} defaultValue={item?.topicId} name="topicId" required><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
      <div className="grid gap-5 md:grid-cols-2"><label className={labelClass}>Title<input className={fieldClass} defaultValue={item?.title} name="title" required /></label><label className={labelClass}>Slug<input className={fieldClass} defaultValue={item?.slug} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label></div>
      <label className={labelClass}>Summary<textarea className={`${fieldClass} min-h-24 py-3`} defaultValue={item?.summary ?? ""} name="summary" /></label>
    </FormSection>
    <FormSection description="Write one safe rich lesson while retaining compatible blocks for existing learner clients." title="Rich lesson content"><LessonEditor existingMedia={existingMedia} initialBlocks={initialBlocks} initialRichContent={item?.richContent} /></FormSection>
    <FormSection title="Reading and order"><div className="grid gap-5 md:grid-cols-2"><label className={labelClass}>Reading time (minutes)<input className={fieldClass} defaultValue={item?.estimatedReadingMinutes ?? 0} max="600" min="0" name="estimatedReadingMinutes" required type="number" /></label><label className={labelClass}>Display order<input className={fieldClass} defaultValue={item?.displayOrder ?? 0} min="0" name="displayOrder" required type="number" /></label></div></FormSection>
  </ActionForm></div>;
}
