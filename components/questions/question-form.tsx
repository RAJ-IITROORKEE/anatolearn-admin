"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { FormAction } from "@/components/phase3/action-form";
import { ActionForm } from "@/components/phase3/action-form";
import { fieldClass, labelClass, panelClass } from "@/components/phase3/admin-ui";
import { cn } from "@/lib/utils";
import { ManagedMediaPicker } from "@/components/media/managed-media-picker";

type AssessmentType = "QUIZ" | "TEST";
type Option = { id?: string; editorId?: string; optionText: string; mediaId?: string | null; isCorrect: boolean };
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

export function QuestionForm({ action, assessmentType, item, topics }: { action: FormAction; assessmentType: AssessmentType; item?: Question; topics: Array<{ id: string; label: string }> }) {
  const [questionText, setQuestionText] = useState(item?.questionText ?? "");
  const [explanation, setExplanation] = useState(item?.explanation ?? "");
  const [options, setOptions] = useState<Option[]>(() => item?.options.map((option, index) => ({ ...option, editorId: option.id ?? `existing-option-${index + 1}` })) ?? emptyOptions());
  const tone = assessmentType === "QUIZ" ? "quiz" : "test";
  const update = (index: number, patch: Partial<Option>) => setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  const markCorrect = (index: number) => setOptions((current) => current.map((option, optionIndex) => ({ ...option, isCorrect: optionIndex === index })));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]">
      <div className={cn(panelClass, tone === "quiz" ? "border-quiz/20" : "border-test/20")}>
        <ActionForm action={action} guardUnsavedChanges="question" label={item ? "Save question" : "Create draft question"}>
          <input name="assessmentType" type="hidden" value={assessmentType} />
          <div className={cn("w-fit rounded-full px-3 py-1 text-xs font-bold", tone === "quiz" ? "bg-quiz-soft text-quiz" : "bg-test-soft text-test")}>{assessmentType === "QUIZ" ? "Quiz question" : "Test question"}</div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Topic<select className={fieldClass} defaultValue={item?.topicId ?? ""} name="topicId" required><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
            <label className={labelClass}>Concept tag <span className="font-normal text-muted">Optional</span><input className={fieldClass} defaultValue={item?.conceptTag ?? ""} name="conceptTag" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Difficulty<select className={fieldClass} defaultValue={item?.difficulty ?? "MEDIUM"} name="difficulty"><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></label><ManagedMediaPicker label="Question image" name="mediaId" value={item?.mediaId} /></div>
          <label className={labelClass}>Question text<textarea className={`${fieldClass} min-h-32 py-3`} name="questionText" onChange={(event) => setQuestionText(event.target.value)} required value={questionText} /></label>
          <fieldset className="grid gap-3">
            <div className="flex items-center justify-between gap-3"><legend className="text-sm font-semibold text-body">Answer options <span className="font-normal text-muted">2-6, exactly one correct</span></legend><button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50" data-form-dirty disabled={options.length >= 6} onClick={() => setOptions((current) => [...current, { editorId: crypto.randomUUID(), optionText: "", mediaId: null, isCorrect: false }])} type="button"><Plus className="size-4" />Add option</button></div>
            {options.map((option, index) => {
              const label = String.fromCharCode(65 + index);
              return <div className="grid gap-3 rounded-xl border border-border bg-subtle p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(220px,.55fr)_auto] sm:items-end" key={option.editorId}>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input aria-label={`Mark option ${label} correct`} checked={option.isCorrect} name="correctOption" onChange={() => markCorrect(index)} type="radio" value={index} /><span>{label}</span></label>
                <label className={labelClass}>Option {label}<input aria-label={`Option ${label}`} className={fieldClass} name={`optionText.${index}`} onChange={(event) => update(index, { optionText: event.target.value })} required value={option.optionText} /></label>
                <ManagedMediaPicker label={`Option ${label} image`} name={`optionMediaId.${index}`} onChange={(id) => update(index, { mediaId: id })} value={option.mediaId} />
                {option.id && <input name={`optionId.${index}`} type="hidden" value={option.id} />}
                <button aria-label={`Remove option ${label}`} className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted hover:text-destructive disabled:opacity-40" data-form-dirty disabled={options.length <= 2} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index).map((entry, nextIndex) => ({ ...entry, isCorrect: entry.isCorrect || (nextIndex === 0 && !current.some((value, oldIndex) => oldIndex !== index && value.isCorrect)) })))} type="button"><Trash2 className="size-4" /></button>
              </div>;
            })}
            <input name="optionCount" type="hidden" value={options.length} />
          </fieldset>
          <label className={labelClass}>Explanation<textarea className={`${fieldClass} min-h-32 py-3`} name="explanation" onChange={(event) => setExplanation(event.target.value)} required value={explanation} /></label>
        </ActionForm>
      </div>
      <aside aria-label="Question preview" className={cn(panelClass, "h-fit xl:sticky xl:top-24", tone === "quiz" ? "border-quiz/20" : "border-test/20")}>
        <p className={cn("text-sm font-bold", tone === "quiz" ? "text-quiz" : "text-test")}>{assessmentType === "QUIZ" ? "Quiz" : "Test"} question preview</p>
        <p className="mt-5 whitespace-pre-wrap font-semibold leading-7 text-foreground">{questionText || "Question text will appear here."}</p>
        <ol className="mt-4 grid gap-2">{options.map((option, index) => <li className={cn("rounded-xl border p-3 text-sm", option.isCorrect ? tone === "quiz" ? "border-quiz/30 bg-quiz-soft font-semibold" : "border-test/30 bg-test-soft font-semibold" : "border-border bg-subtle")} key={option.editorId}><span className="mr-2 font-bold">{String.fromCharCode(65 + index)}.</span>{option.optionText || "Empty option"}{option.isCorrect && <span className="ml-2 text-xs">Correct</span>}</li>)}</ol>
        <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-bold text-muted">Explanation</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">{explanation || "Explanation will appear here."}</p></div>
      </aside>
    </div>
  );
}
