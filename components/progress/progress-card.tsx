import { ProgressMetric } from "./progress-metric";

type Metric = { numerator: number; denominator: number; percentage: number };
export type ProgressTopic = { id: string; title: string; content: Metric; flashcards: Metric; quiz: Metric; test: Metric };
export type ProgressSystem = { id: string; name: string; content: Metric; flashcards: Metric; quiz: Metric; test: Metric; topics: ProgressTopic[] };

export function ProgressCard({ system }: { system: ProgressSystem }) {
  return (
    <details className="group min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <summary className="cursor-pointer list-none break-words text-lg font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{system.name}<span className="ml-2 text-sm font-medium text-muted group-open:hidden">Show details</span><span className="ml-2 hidden text-sm font-medium text-muted group-open:inline">Hide details</span></summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressMetric label="Content complete" metric={system.content} />
        <ProgressMetric label="Flashcards mastered" metric={system.flashcards} />
        <ProgressMetric label="Quiz accuracy" metric={system.quiz} />
        <ProgressMetric label="Test accuracy" metric={system.test} />
      </div>
      {system.topics.length > 0 && <div className="mt-5 border-t border-border pt-5">
        <h3 className="text-sm font-bold text-foreground">Topics</h3>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {system.topics.map((topic) => <section className="min-w-0 rounded-xl border border-border p-3" key={topic.id} aria-labelledby={`topic-${topic.id}`}>
            <h4 className="break-words font-bold text-body" id={`topic-${topic.id}`}>{topic.title}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ProgressMetric label="Content complete" metric={topic.content} />
              <ProgressMetric label="Flashcards mastered" metric={topic.flashcards} />
              <ProgressMetric label="Quiz accuracy" metric={topic.quiz} />
              <ProgressMetric label="Test accuracy" metric={topic.test} />
            </div>
          </section>)}
        </div>
      </div>}
    </details>
  );
}
