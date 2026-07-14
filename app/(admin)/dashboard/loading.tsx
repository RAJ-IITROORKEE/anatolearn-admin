export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="animate-pulse space-y-6">
      <span className="sr-only">Loading dashboard</span>
      <div className="h-24 rounded-2xl bg-subtle" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <div className="h-36 rounded-2xl border border-border bg-surface" key={index} />)}</div>
      <div className="grid gap-6 xl:grid-cols-3"><div className="h-96 rounded-2xl border border-border bg-surface xl:col-span-2" /><div className="h-96 rounded-2xl border border-border bg-surface" /></div>
    </div>
  );
}
