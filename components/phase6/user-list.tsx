import Link from "next/link";

import { formatDateTime } from "@/components/assessments/format";
import { changeUserActivityAction } from "@/app/(admin)/phase6-actions";
import { ConfirmedAction } from "./confirmed-action";
import { Phase6StatusBadge } from "./status-badge";

export type UserListItem = {
  id: string; fullName: string; email: string; isActive: boolean; createdAt: Date; lastLoginAt: Date | null;
};

function UserAction({ user }: { user: UserListItem }) {
  const activating = !user.isActive;
  return <ConfirmedAction
    action={changeUserActivityAction.bind(null, user.id, activating)}
    confirmLabel={`${activating ? "Activate" : "Deactivate"} user`}
    description={activating ? "This learner will regain access. Device tokens remain inactive until the learner registers them again." : "This learner will lose access and active device tokens will be disabled. Learning history is preserved."}
    destructive={!activating}
    title={`${activating ? "Activate" : "Deactivate"} ${user.fullName}?`}
  >{activating ? "Activate" : "Deactivate"}</ConfirmedAction>;
}

export function UserList({ users }: { users: UserListItem[] }) {
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm md:block">
      <table className="w-full border-collapse text-left text-sm"><caption className="sr-only">Learner accounts</caption><thead className="bg-subtle text-muted"><tr><th className="px-4 py-3 font-semibold" scope="col">Learner</th><th className="px-4 py-3 font-semibold" scope="col">Status</th><th className="px-4 py-3 font-semibold" scope="col">Joined</th><th className="px-4 py-3 font-semibold" scope="col">Last login</th><th className="px-4 py-3 text-right font-semibold" scope="col">Action</th></tr></thead>
        <tbody>{users.map((user) => <tr className="border-t border-border" key={user.id}><th className="px-4 py-4 font-normal" scope="row"><Link className="font-bold text-foreground hover:text-primary" href={`/users/${user.id}`}>{user.fullName}</Link><p className="mt-1 break-all text-muted">{user.email}</p></th><td className="px-4 py-4"><Phase6StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} /></td><td className="px-4 py-4 tabular-nums text-body">{formatDateTime(user.createdAt)}</td><td className="px-4 py-4 tabular-nums text-body">{formatDateTime(user.lastLoginAt)}</td><td className="px-4 py-4"><div className="flex justify-end"><UserAction user={user} /></div></td></tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 md:hidden">{users.map((user) => <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={user.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="font-bold text-foreground" href={`/users/${user.id}`}>{user.fullName}</Link><p className="mt-1 break-all text-sm text-muted">{user.email}</p></div><Phase6StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} /></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm"><div><dt className="font-semibold text-muted">Joined</dt><dd className="mt-1 text-body">{formatDateTime(user.createdAt)}</dd></div><div><dt className="font-semibold text-muted">Last login</dt><dd className="mt-1 text-body">{formatDateTime(user.lastLoginAt)}</dd></div></dl><div className="mt-4 flex justify-end"><UserAction user={user} /></div></article>)}</div>
  </>;
}
