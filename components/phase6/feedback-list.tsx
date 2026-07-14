import Link from "next/link";

import { formatDateTime } from "@/components/assessments/format";
import { Phase6StatusBadge } from "./status-badge";

export type FeedbackListItem = {
  id: string; subject: string; message: string; type: string; status: string; createdAt: Date;
  submitter: { fullName: string; email: string } | null;
};
const typeLabel = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export function FeedbackList({ items }: { items: FeedbackListItem[] }) {
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm md:block"><table className="w-full border-collapse text-left text-sm"><caption className="sr-only">Submitted feedback</caption><thead className="bg-subtle text-muted"><tr><th className="px-4 py-3 font-semibold" scope="col">Feedback</th><th className="px-4 py-3 font-semibold" scope="col">User</th><th className="px-4 py-3 font-semibold" scope="col">Type</th><th className="px-4 py-3 font-semibold" scope="col">Status</th><th className="px-4 py-3 font-semibold" scope="col">Submitted</th></tr></thead><tbody>{items.map((item) => <tr className="border-t border-border" key={item.id}><th className="max-w-md px-4 py-4 font-normal" scope="row"><Link className="font-bold text-foreground hover:text-primary" href={`/feedback/${item.id}`}>{item.subject}</Link><p className="mt-1 line-clamp-2 text-muted">{item.message}</p></th><td className="px-4 py-4 text-body">{item.submitter ? <><p className="font-semibold">{item.submitter.fullName}</p><p className="break-all text-muted">{item.submitter.email}</p></> : "Unknown user"}</td><td className="px-4 py-4 text-body">{typeLabel(item.type)}</td><td className="px-4 py-4"><Phase6StatusBadge status={item.status} /></td><td className="px-4 py-4 tabular-nums text-body">{formatDateTime(item.createdAt)}</td></tr>)}</tbody></table></div>
    <div className="grid gap-3 md:hidden">{items.map((item) => <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={item.id}><div className="flex items-start justify-between gap-3"><Link className="font-bold text-foreground" href={`/feedback/${item.id}`}>{item.subject}</Link><Phase6StatusBadge status={item.status} /></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{item.message}</p><dl className="mt-4 grid gap-2 border-t border-border pt-3 text-sm"><div className="flex justify-between gap-3"><dt className="font-semibold text-muted">User</dt><dd className="text-right text-body">{item.submitter?.fullName ?? "Unknown user"}</dd></div><div className="flex justify-between gap-3"><dt className="font-semibold text-muted">Type</dt><dd className="text-body">{typeLabel(item.type)}</dd></div><div className="flex justify-between gap-3"><dt className="font-semibold text-muted">Submitted</dt><dd className="text-right text-body">{formatDateTime(item.createdAt)}</dd></div></dl></article>)}</div>
  </>;
}
