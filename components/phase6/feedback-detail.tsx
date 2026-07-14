import Link from "next/link";

import { changeFeedbackStatusAction, updateFeedbackNotesAction } from "@/app/(admin)/phase6-actions";
import { formatDateTime } from "@/components/assessments/format";
import { ActionForm } from "@/components/phase3/action-form";
import { fieldClass, labelClass, panelClass } from "@/components/phase3/admin-ui";
import { ConfirmedAction } from "./confirmed-action";
import { Phase6StatusBadge } from "./status-badge";

type Person = { id: string; fullName: string; email: string; isActive: boolean };
export type FeedbackDetailData = {
  id: string; type: string; subject: string; message: string; status: string; adminNotes: string | null;
  createdAt: Date; updatedAt: Date; reviewedAt: Date | null; resolvedAt: Date | null;
  submitter: Person | null; reviewer: Person | null; resolver: Person | null;
};

function PersonValue({ person }: { person: Person | null }) {
  if (!person) return <span>Not recorded</span>;
  return <span>{person.fullName} <span className="text-muted">({person.email})</span></span>;
}

export function FeedbackDetail({ feedback }: { feedback: FeedbackDetailData }) {
  const next = feedback.status === "NEW" ? { status: "REVIEWED", verb: "Mark reviewed", title: "Mark this feedback reviewed?", description: "Your administrator identity and the review time will be recorded." } : feedback.status === "REVIEWED" ? { status: "RESOLVED", verb: "Resolve feedback", title: "Resolve this feedback?", description: "Resolution is terminal and records your administrator identity and the resolution time." } : null;
  const type = feedback.type.replaceAll("_", " ").toLowerCase().replace(/^./, (value) => value.toUpperCase());
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm font-semibold text-primary">Feedback detail</p><h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{feedback.subject}</h1><div className="mt-3 flex flex-wrap gap-2"><Phase6StatusBadge status={feedback.status} /><span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold text-body">{type}</span></div></div>{next && <ConfirmedAction action={changeFeedbackStatusAction.bind(null, feedback.id, next.status)} confirmLabel={next.verb} description={next.description} title={next.title}>{next.verb}</ConfirmedAction>}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="grid min-w-0 gap-6"><section className={panelClass} aria-labelledby="feedback-message"><h2 className="text-lg font-bold" id="feedback-message">Message</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-body">{feedback.message}</p></section>
        <section className={panelClass} aria-labelledby="internal-notes"><h2 className="text-lg font-bold" id="internal-notes">Internal notes</h2><p className="mt-1 text-sm text-muted">Visible only to administrators.</p><div className="mt-4"><ActionForm action={updateFeedbackNotesAction.bind(null, feedback.id)} label="Save internal notes"><label className={labelClass}>Notes<textarea className={`${fieldClass} min-h-36 py-3`} defaultValue={feedback.adminNotes ?? ""} maxLength={5000} name="adminNotes" /></label></ActionForm></div></section>
      </div>
      <aside className={panelClass} aria-labelledby="feedback-metadata"><h2 className="text-lg font-bold" id="feedback-metadata">Submission details</h2><dl className="mt-4 grid gap-4 text-sm"><div><dt className="font-semibold text-muted">Submitted by</dt><dd className="mt-1 text-body">{feedback.submitter ? <Link className="font-semibold text-primary hover:underline" href={`/users/${feedback.submitter.id}`}>{feedback.submitter.fullName}</Link> : "Unknown user"}{feedback.submitter && <span className="block break-all text-muted">{feedback.submitter.email}</span>}</dd></div><div><dt className="font-semibold text-muted">Submitted</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(feedback.createdAt)}</dd></div><div><dt className="font-semibold text-muted">Last updated</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(feedback.updatedAt)}</dd></div><div><dt className="font-semibold text-muted">Reviewed by</dt><dd className="mt-1 text-body"><PersonValue person={feedback.reviewer} />{feedback.reviewedAt && <span className="block tabular-nums text-muted">{formatDateTime(feedback.reviewedAt)}</span>}</dd></div><div><dt className="font-semibold text-muted">Resolved by</dt><dd className="mt-1 text-body"><PersonValue person={feedback.resolver} />{feedback.resolvedAt && <span className="block tabular-nums text-muted">{formatDateTime(feedback.resolvedAt)}</span>}</dd></div></dl></aside>
    </div>
  </>;
}
