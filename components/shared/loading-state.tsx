export function LoadingState({ label = "Loading content" }: { label?: string }) {
  return (
    <div aria-label={label} aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div className="h-28 animate-pulse rounded-2xl border border-border bg-subtle" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <div className="h-36 animate-pulse rounded-2xl border border-border bg-surface" key={item} />)}
      </div>
    </div>
  );
}
