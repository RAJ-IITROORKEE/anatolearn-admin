"use client";

import { useState } from "react";

import type { FormAction } from "@/components/phase3/action-form";
import { ActionForm } from "@/components/phase3/action-form";
import { fieldClass, labelClass, panelClass } from "@/components/phase3/admin-ui";
import { DirectImageInput } from "@/components/media/direct-image-input";

type Flashcard = {
  topicId: string;
  frontText: string;
  backText: string;
  frontMediaId: string | null;
  backMediaId: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  notes: string | null;
  displayOrder: number;
};

export function FlashcardForm({ action, item, topics }: { action: FormAction; item?: Flashcard; topics: Array<{ id: string; label: string }> }) {
  const [front, setFront] = useState(item?.frontText ?? "");
  const [back, setBack] = useState(item?.backText ?? "");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.65fr)]">
      <div className={panelClass}>
        <ActionForm action={action} guardUnsavedChanges="flashcard" label={item ? "Save flashcard" : "Create flashcard"}>
          <label className={labelClass}>Topic<select className={fieldClass} defaultValue={item?.topicId ?? ""} name="topicId" required><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClass}>Front text<textarea className={`${fieldClass} min-h-44 py-3`} name="frontText" onChange={(event) => setFront(event.target.value)} required value={front} /></label>
            <label className={labelClass}>Back text<textarea className={`${fieldClass} min-h-44 py-3`} name="backText" onChange={(event) => setBack(event.target.value)} required value={back} /></label>
          </div>
           <div className="grid gap-5 md:grid-cols-2"><DirectImageInput label="Front image" fileName="frontFile" altTextName="frontAltText" mediaIdName="frontMediaId" clearName="clearFront" existingMediaId={item?.frontMediaId} /><DirectImageInput label="Back image" fileName="backFile" altTextName="backAltText" mediaIdName="backMediaId" clearName="clearBack" existingMediaId={item?.backMediaId} /></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Difficulty<select className={fieldClass} defaultValue={item?.difficulty ?? "MEDIUM"} name="difficulty"><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></label>
            <label className={labelClass}>Display order<input className={fieldClass} defaultValue={item?.displayOrder ?? 0} min="0" name="displayOrder" required type="number" /></label>
          </div>
          <label className={labelClass}>Editorial notes <span className="font-normal text-muted">Optional, not shown to learners</span><textarea className={`${fieldClass} min-h-28 py-3`} defaultValue={item?.notes ?? ""} name="notes" /></label>
        </ActionForm>
      </div>
      <aside aria-label="Flashcard preview" className={`${panelClass} h-fit border-success/20 xl:sticky xl:top-24`}>
        <p className="text-sm font-bold text-success">Live flashcard preview</p>
        <div className="mt-4 grid gap-3">
          <section className="min-h-36 rounded-2xl border border-success/20 bg-success-soft p-5"><p className="text-xs font-bold text-success">Front</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{front || "Front text will appear here."}</p></section>
          <section className="min-h-36 rounded-2xl border border-border bg-subtle p-5"><p className="text-xs font-bold text-muted">Back</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{back || "Back text will appear here."}</p></section>
        </div>
      </aside>
    </div>
  );
}
