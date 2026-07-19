"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { FormAction } from "@/components/phase3/action-form";
import { ActionForm } from "@/components/phase3/action-form";
import { fieldClass, labelClass, panelClass, StatusBadge } from "@/components/phase3/admin-ui";
import { cn } from "@/lib/utils";
import { DirectImageInput } from "@/components/media/direct-image-input";

type AssessmentType = "QUIZ" | "TEST";
type Option = { id?: string; editorId?: string; optionText: string; mediaId?: string | null; isCorrect: boolean };
type ExistingMedia = Record<string, { signedUrl: string; altText: string }>;
type Question = {
  topicId: string;
  questionText: string;
  mediaId: string | null;
  explanation: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  conceptTag: string | null;
  options: Option[];
};

const emptyOptions = (): Option[] => Array.from({ length: 4 }, (_, index) => ({ editorId: `new-option-${index + 1}`, optionText: "", mediaId: null, isCorrect: index === 0 }));

export function QuestionForm({ action, assessmentType, existingMedia = {}, item, publicationActions, publicationStatus, activityStatus, topics }: { action: FormAction; assessmentType: AssessmentType; existingMedia?: ExistingMedia; item?: Question; publicationActions?: ReactNode; publicationStatus?: string; activityStatus?: string; topics: Array<{ id: string; label: string }> }) {
  const [questionText, setQuestionText] = useState(item?.questionText ?? "");
  const [explanation, setExplanation] = useState(item?.explanation ?? "");
  const [options, setOptions] = useState<Option[]>(() => item?.options.map((option, index) => ({ ...option, editorId: option.id ?? `existing-option-${index + 1}` })) ?? emptyOptions());
  const tone = assessmentType === "QUIZ" ? "quiz" : "test";
  const update = (index: number, patch: Partial<Option>) => setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  const markCorrect = (index: number) => setOptions((current) => current.map((option, optionIndex) => ({ ...option, isCorrect: optionIndex === index })));
  const questionMedia = item?.mediaId ? existingMedia[item.mediaId] : undefined;
  const accentBorder = tone === "quiz" ? "border-quiz/20" : "border-test/20";

  return (
    <div>
      <ActionForm action={action} guardUnsavedChanges="question" label={item ? "Save question" : "Create draft question"}>
        <input name="assessmentType" type="hidden" value={assessmentType} />
        <div className={cn("w-fit rounded-full px-3 py-1 text-xs font-bold", tone === "quiz" ? "bg-quiz-soft text-quiz" : "bg-test-soft text-test")}>{assessmentType === "QUIZ" ? "Quiz question" : "Test question"}</div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]" data-testid="question-editor-layout">
          <aside aria-label="Question metadata" className={cn(panelClass, "order-1 h-fit xl:sticky xl:top-24 xl:order-2", accentBorder)}>
            <h2 className="text-base font-bold text-foreground">Metadata</h2>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>Topic<select className={fieldClass} defaultValue={item?.topicId ?? ""} name="topicId" required><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
              <label className={labelClass}>Concept tag <span className="font-normal text-muted">Optional</span><input className={fieldClass} defaultValue={item?.conceptTag ?? ""} name="conceptTag" /></label>
              <label className={`${labelClass} self-start`}>Difficulty<select className={`${fieldClass} max-w-40`} defaultValue={item?.difficulty ?? "MEDIUM"} name="difficulty"><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></label>
            </div>
          </aside>

          <div className="order-2 grid min-w-0 gap-5 xl:order-1">
            <section aria-labelledby="question-details-heading" className={cn(panelClass, accentBorder)} role="region">
              <div className="mb-5"><h2 className="text-lg font-bold text-foreground" id="question-details-heading">Question Details</h2><p className="mt-1 text-sm text-muted">Write the learner-facing prompt and add an optional supporting image.</p></div>
              <div className="grid gap-5">
                <label className={labelClass}>Question text<textarea className={`${fieldClass} min-h-36 py-3`} name="questionText" onChange={(event) => setQuestionText(event.target.value)} required value={questionText} /></label>
                <DirectImageInput altTextName="questionAltText" clearName="clearQuestionImage" compact existingAltText={questionMedia?.altText} existingMediaId={item?.mediaId} existingPreviewUrl={questionMedia?.signedUrl} fileName="questionFile" label="Question image" mediaIdName="mediaId" />
              </div>
            </section>

            <fieldset aria-label="Answer options, 2-6, exactly one correct" className={cn(panelClass, "grid gap-4", accentBorder)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="text-lg font-bold text-foreground" id="answer-options-heading">Answer Options</h2><p className="mt-1 text-sm text-muted">Add 2-6 choices and select exactly one correct answer.</p></div>
                <button className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50" data-form-dirty disabled={options.length >= 6} onClick={() => setOptions((current) => [...current, { editorId: crypto.randomUUID(), optionText: "", mediaId: null, isCorrect: false }])} type="button"><Plus className="size-4" />Add option</button>
              </div>
              {options.map((option, index) => {
                const label = String.fromCharCode(65 + index);
                const optionMedia = option.mediaId ? existingMedia[option.mediaId] : undefined;
                return <article className={cn("rounded-2xl border bg-subtle p-4", option.isCorrect ? tone === "quiz" ? "border-quiz/40" : "border-test/40" : "border-border")} key={option.editorId}>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input aria-label={`Mark option ${label} correct`} checked={option.isCorrect} name="correctOption" onChange={() => markCorrect(index)} type="radio" value={index} /><span className={cn("inline-flex size-8 items-center justify-center rounded-full font-bold", option.isCorrect ? tone === "quiz" ? "bg-quiz-soft text-quiz" : "bg-test-soft text-test" : "bg-surface text-body")}>{label}</span><span>{option.isCorrect ? "Correct answer" : "Mark as correct"}</span></label>
                    <button aria-label={`Remove option ${label}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:text-destructive disabled:opacity-40" data-form-dirty disabled={options.length <= 2} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index).map((entry, nextIndex) => ({ ...entry, isCorrect: entry.isCorrect || (nextIndex === 0 && !current.some((value, oldIndex) => oldIndex !== index && value.isCorrect)) })))} type="button"><Trash2 className="size-4" /></button>
                  </div>
                  <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)] lg:items-start">
                    <label className={labelClass}>Option {label}<input aria-label={`Option ${label}`} className={fieldClass} name={`optionText.${index}`} onChange={(event) => update(index, { optionText: event.target.value })} required value={option.optionText} /></label>
                    <DirectImageInput altTextName={`optionAltText.${index}`} clearName={`clearOption.${index}`} compact existingAltText={optionMedia?.altText} existingMediaId={option.mediaId} existingPreviewUrl={optionMedia?.signedUrl} fileName={`optionFile.${index}`} label={`Option ${label} image`} mediaIdName={`optionMediaId.${index}`} />
                  </div>
                  {option.id && <input name={`optionId.${index}`} type="hidden" value={option.id} />}
                </article>;
              })}
              <input name="optionCount" type="hidden" value={options.length} />
            </fieldset>

            <section aria-labelledby="answer-explanation-heading" className={cn(panelClass, accentBorder)} role="region">
              <div className="mb-5"><h2 className="text-lg font-bold text-foreground" id="answer-explanation-heading">Answer &amp; Explanation</h2><p className="mt-1 text-sm text-muted">The correct answer is selected in the option cards above. Explain why it is correct.</p></div>
              <label className={labelClass}>Explanation<textarea className={`${fieldClass} min-h-36 py-3`} name="explanation" onChange={(event) => setExplanation(event.target.value)} required value={explanation} /></label>
            </section>

            <aside aria-label="Question preview" className={cn(panelClass, accentBorder)}>
              <p className={cn("text-sm font-bold", tone === "quiz" ? "text-quiz" : "text-test")}>{assessmentType === "QUIZ" ? "Quiz" : "Test"} question preview</p>
              <p className="mt-5 whitespace-pre-wrap font-semibold leading-7 text-foreground">{questionText || "Question text will appear here."}</p>
              <ol className="mt-4 grid gap-2">{options.map((option, index) => <li className={cn("rounded-xl border p-3 text-sm", option.isCorrect ? tone === "quiz" ? "border-quiz/30 bg-quiz-soft font-semibold" : "border-test/30 bg-test-soft font-semibold" : "border-border bg-subtle")} key={option.editorId}><span className="mr-2 font-bold">{String.fromCharCode(65 + index)}.</span>{option.optionText || "Empty option"}{option.isCorrect && <span className="ml-2 text-xs">Correct</span>}</li>)}</ol>
              <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-bold text-muted">Explanation</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">{explanation || "Explanation will appear here."}</p></div>
            </aside>
          </div>
        </div>
      </ActionForm>

      <section aria-label="Publication" className={cn(panelClass, "mt-5", accentBorder)} role="region">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-foreground">Publication</h2><p className="mt-1 text-sm text-muted">{item ? "Lifecycle actions apply to the last saved version. Save your edits before publishing." : "New questions are created as a draft. Save the question before publishing it."}</p></div>{publicationStatus ? <div className="flex flex-wrap gap-2"><StatusBadge status={publicationStatus} />{activityStatus ? <StatusBadge status={activityStatus} /> : null}</div> : null}</div>
        {publicationActions ? <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">{publicationActions}</div> : null}
      </section>
    </div>
  );
}
