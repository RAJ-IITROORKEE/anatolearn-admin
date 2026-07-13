import { ProgressMetric } from "./progress-metric";

type Metric = { numerator: number; denominator: number; percentage: number };
export type ProgressTopic = { id: string; title: string; content: Metric; flashcards: Metric; quiz: Metric; test: Metric };
export type ProgressSystem = { id: string; name: string; content: Metric; flashcards: Metric; quiz: Metric; test: Metric; topics: ProgressTopic[] };

export function ProgressCard({ system }: { system: ProgressSystem }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-foreground">{system.name}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressMetric label="Content complete" metric={system.content} />
        <ProgressMetric label="Flashcards mastered" metric={system.flashcards} />
        <ProgressMetric label="Quiz accuracy" metric={system.quiz} />
        <ProgressMetric label="Test accuracy" metric={system.test} />
      </div>
      {system.topics.length > 0 && <div className="mt-5 border-t border-border pt-5">
        <h4 className="text-sm font-bold text-foreground">Topics</h4>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {system.topics.map((topic) => <section className="rounded-xl border border-border p-3" key={topic.id} aria-labelledby={`topic-${topic.id}`}>
            <h5 className="font-bold text-body" id={`topic-${topic.id}`}>{topic.title}</h5>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ProgressMetric label="Content complete" metric={topic.content} />
              <ProgressMetric label="Flashcards mastered" metric={topic.flashcards} />
              <ProgressMetric label="Quiz accuracy" metric={topic.quiz} />
              <ProgressMetric label="Test accuracy" metric={topic.test} />
            </div>
          </section>)}
        </div>
      </div>}
    </article>
  );
}
