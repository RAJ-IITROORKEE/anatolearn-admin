"use client";

import { BellRing, Clock3, Send } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { ActionNotice, fieldClass, labelClass, panelClass } from "@/components/phase3/admin-ui";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { PendingButton } from "@/components/shared/pending-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationActionState } from "./campaign-actions";
import { LearnerPicker, type LearnerOption, type LearnerSearchResult } from "./learner-picker";
import { UnsavedNavigationGuard } from "./unsaved-navigation-guard";

type Campaign = {
  type: string; title: string; message: string; target: unknown; scheduledAt: Date | string | null;
};

function initialAudience(target: unknown) {
  return target && typeof target === "object" && "type" in target && target.type === "SELECTED_USERS" ? "SELECTED_USERS" : "ALL_ACTIVE_USERS";
}

export function CampaignEditor({ action, campaign, learners, providerReady, searchAction, selectedLearners }: {
  action: (state: NotificationActionState, data: FormData) => Promise<NotificationActionState>;
  campaign?: Campaign;
  learners: LearnerSearchResult;
  selectedLearners?: LearnerOption[];
  searchAction: (query: string, page: number) => Promise<LearnerSearchResult>;
  providerReady: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [message, setMessage] = useState(campaign?.message ?? "");
  const [audience, setAudience] = useState(initialAudience(campaign?.target));
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);

  const confirmSubmit = (intent: "schedule" | "send") => {
    if (intentRef.current) intentRef.current.value = intent;
    formRef.current?.requestSubmit();
  };

  return <><UnsavedNavigationGuard dirty={dirty} /><form action={formAction} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.65fr)]" onChange={() => setDirty(true)} ref={formRef}>
    <input name="intent" ref={intentRef} type="hidden" value="draft" />
    <section className={panelClass}>
      <div className="grid gap-5">
        <label className={labelClass}>Notification type<select className={fieldClass} defaultValue={campaign?.type ?? "ANNOUNCEMENT"} name="type"><option value="ANNOUNCEMENT">Announcement</option><option value="DAILY_STUDY">Daily study reminder</option><option value="TEST_REMINDER">Test reminder</option></select></label>
        <label className={labelClass}>Title <span className="ml-auto font-normal text-muted">{title.length} / 100</span><input aria-label="Title" className={fieldClass} maxLength={100} name="title" onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
        <label className={labelClass}>Message <span className="ml-auto font-normal text-muted">{message.length} / 1000</span><textarea aria-label="Message" className={cn(fieldClass, "min-h-40 py-3")} maxLength={1000} name="message" onChange={(event) => setMessage(event.target.value)} required value={message} /></label>
        <fieldset className="grid gap-3 rounded-2xl border border-border bg-subtle p-4">
          <legend className="px-1 text-sm font-semibold text-body">Audience</legend>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-surface p-3 text-sm"><input checked={audience === "ALL_ACTIVE_USERS"} className="mt-1" name="audienceType" onChange={() => setAudience("ALL_ACTIVE_USERS")} type="radio" value="ALL_ACTIVE_USERS" /><span><strong className="block text-foreground">All active learners</strong><span className="text-muted">Membership is determined safely when processing starts.</span></span></label>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-surface p-3 text-sm"><input aria-label="Selected active learners" checked={audience === "SELECTED_USERS"} className="mt-1" name="audienceType" onChange={() => setAudience("SELECTED_USERS")} type="radio" value="SELECTED_USERS" /><span><strong className="block text-foreground">Selected active learners</strong><span className="text-muted">Choose only from the active learner directory below.</span></span></label>
          {audience === "SELECTED_USERS" && <LearnerPicker initial={learners} initialSelected={selectedLearners ?? []} onDirty={() => setDirty(true)} searchAction={searchAction} />}
        </fieldset>
        <label className={labelClass}>Schedule time <span className="font-normal text-muted">At least 60 seconds in the future</span><input className={fieldClass} defaultValue={campaign?.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : ""} name="scheduledAt" type="datetime-local" /></label>
        {!providerReady && <p className="rounded-xl border border-warning/20 bg-warning-soft p-3 text-sm text-body" role="status">The delivery provider is not ready. Drafting and scheduling remain available; send now is disabled.</p>}
        <ActionNotice state={state} />
        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:flex-wrap">
          <PendingButton name="intent" pending={pending} pendingLabel="Saving..." type="submit" value="draft" variant="outline">Save draft</PendingButton>
          <ConfirmationDialog confirmLabel="Schedule campaign" description="The audience will be materialized when provider processing begins." onConfirm={() => confirmSubmit("schedule")} pending={pending} title="Schedule this campaign?">
            <Button disabled={pending} type="button" variant="outline"><Clock3 aria-hidden="true" className="size-4" />Schedule</Button>
          </ConfirmationDialog>
          <ConfirmationDialog confirmLabel="Queue campaign" description="This queues provider processing. Provider tickets are not delivery receipts." onConfirm={() => confirmSubmit("send")} pending={pending} title="Send this campaign now?">
            <Button disabled={!providerReady || pending} type="button"><Send aria-hidden="true" className="size-4" />Send now</Button>
          </ConfirmationDialog>
        </div>
      </div>
    </section>
    <aside aria-label="Notification preview" className={cn(panelClass, "h-fit xl:sticky xl:top-24")}>
      <div className="flex items-center gap-2 text-sm font-bold text-primary"><BellRing aria-hidden="true" className="size-4" />Message preview</div>
      <div className="mt-5 rounded-2xl border border-border bg-subtle p-4 shadow-sm">
        <h2 className="font-bold text-foreground">{title || "Notification title"}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">{message || "Your message will appear here."}</p>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">Preview only. Appearance and physical display vary by device settings and are not confirmed by this preview.</p>
      {dirty && <p className="mt-4 text-sm font-medium text-warning" role="status">You have unsaved changes.</p>}
    </aside>
  </form></>;
}
