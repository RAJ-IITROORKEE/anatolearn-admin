"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import type { AdminDashboardDto } from "@/features/admin-dashboard/dto";

type TrendPoint = AdminDashboardDto["attemptsTrend"][number];

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function valueText(point: TrendPoint) {
  const quizLabel = point.quizAttempts === 1 ? "attempt" : "attempts";
  const testLabel = point.testAttempts === 1 ? "attempt" : "attempts";
  return `${formatDay(point.date)}: ${point.quizAttempts} quiz ${quizLabel} and ${point.testAttempts} test ${testLabel}`;
}

export function AttemptsTrendChart({ data, days }: { data: AdminDashboardDto["attemptsTrend"]; days: 7 | 30 | 90 }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, data.length - 1));
  const [isInspecting, setIsInspecting] = useState(false);
  const quizTotal = data.reduce((total, day) => total + day.quizAttempts, 0);
  const testTotal = data.reduce((total, day) => total + day.testAttempts, 0);
  const hasAttempts = quizTotal + testTotal > 0;
  const selected = data[selectedIndex] ?? data[0];
  const maxValue = Math.max(1, ...data.flatMap((day) => [day.quizAttempts, day.testAttempts]));
  const width = 800;
  const height = 260;
  const plot = { top: 20, right: 16, bottom: 34, left: 38 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (index: number) => plot.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => plot.top + plotHeight - (value / maxValue) * plotHeight;
  const points = (key: "quizAttempts" | "testAttempts") => data.map((day, index) => `${x(index)},${y(day[key])}`).join(" ");
  const selectedX = x(selectedIndex);
  const summary = hasAttempts
    ? `${quizTotal} quiz attempts and ${testTotal} test attempts across ${data.length} days.`
    : "No attempts recorded in this range.";
  const xLabelIndexes = Array.from(new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]));

  function selectFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || data.length < 2) return;
    const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * width;
    const plotX = Math.min(width - plot.right, Math.max(plot.left, viewBoxX));
    const ratio = (plotX - plot.left) / plotWidth;
    setSelectedIndex(Math.round(ratio * (data.length - 1)));
    setIsInspecting(true);
  }

  function inspectWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    let next = selectedIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = data.length - 1;
    else return;
    event.preventDefault();
    setSelectedIndex(Math.min(data.length - 1, Math.max(0, next)));
    setIsInspecting(true);
  }

  return (
    <section aria-labelledby="attempts-trend-heading" className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary">Selected {days}-day range</p>
          <h2 className="mt-1 text-lg font-bold text-foreground sm:text-xl" id="attempts-trend-heading">Attempts trend</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Submitted quiz and test attempts by UTC completion date.</p>
        </div>
        <div aria-label="Chart legend" className="flex flex-wrap gap-4 text-xs font-semibold text-body">
          <span className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-5 bg-quiz" />Quiz</span>
          <span className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-test" />Test</span>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-border bg-subtle px-4 py-3 text-sm font-semibold text-body" id="attempts-summary">{summary}</p>

      {hasAttempts && selected ? (
        <div className="mt-5">
          <div className="mb-3 flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-soft px-4 py-2 text-sm" aria-live="polite">
            <strong className="text-foreground">Selected: {formatDay(selected.date)}</strong>
            <span className="flex gap-4 tabular-nums text-body">
              <span><span className="font-bold text-quiz">{selected.quizAttempts}</span> quiz</span>
              <span><span className="font-bold text-test">{selected.testAttempts}</span> test</span>
            </span>
          </div>
          <div
            aria-describedby="attempts-summary attempts-chart-help"
            aria-label="Inspect daily attempt values"
            aria-orientation="horizontal"
            aria-valuemax={data.length - 1}
            aria-valuemin={0}
            aria-valuenow={selectedIndex}
            aria-valuetext={valueText(selected)}
            className="cursor-crosshair overflow-hidden rounded-xl border border-border bg-subtle p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onBlur={() => setIsInspecting(false)}
            onFocus={() => setIsInspecting(true)}
            onKeyDown={inspectWithKeyboard}
            onMouseLeave={(event) => {
              if (document.activeElement !== event.currentTarget) setIsInspecting(false);
            }}
            onPointerMove={selectFromPointer}
            role="slider"
            tabIndex={0}
          >
            <svg aria-hidden="true" className="h-auto min-h-56 w-full" preserveAspectRatio="none" ref={svgRef} viewBox={`0 0 ${width} ${height}`}>
              {[0, 0.5, 1].map((position) => {
                const tickValue = Math.round(maxValue * (1 - position));
                const tickY = plot.top + position * plotHeight;
                return <g key={position}><line className="stroke-border" strokeWidth="1" x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} /><text className="fill-muted text-[11px] tabular-nums" textAnchor="end" x={plot.left - 8} y={tickY + 4}>{tickValue}</text></g>;
              })}
              {xLabelIndexes.map((index) => <text className="fill-muted text-[11px]" key={index} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} x={x(index)} y={height - 8}>{formatShortDay(data[index].date)}</text>)}
              <polyline className="dashboard-trend-series fill-none stroke-quiz" data-testid="quiz-trend-line" points={points("quizAttempts")} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <polyline className="dashboard-trend-series fill-none stroke-test" data-testid="test-trend-line" points={points("testAttempts")} strokeDasharray="10 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <g className={isInspecting ? "opacity-100" : "opacity-0"}>
                <line className="stroke-primary transition-opacity" strokeDasharray="3 4" strokeWidth="1" x1={selectedX} x2={selectedX} y1={plot.top} y2={plot.top + plotHeight} />
                <circle className="fill-surface stroke-quiz" cx={selectedX} cy={y(selected.quizAttempts)} r="5" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <circle className="fill-surface stroke-test" cx={selectedX} cy={y(selected.testAttempts)} r="5" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </g>
            </svg>
          </div>
          <p className="mt-2 text-xs text-muted" id="attempts-chart-help">Hover to inspect a day. Keyboard users can focus the chart and use arrow, Home, and End keys.</p>
        </div>
      ) : null}

      <div className="app-scrollbar mt-5 max-h-60 overflow-auto rounded-xl border border-border">
        <table aria-describedby="attempts-summary" aria-label="Attempts trend data" className="w-full min-w-96 text-left text-sm tabular-nums">
          <thead className="sticky top-0 bg-subtle text-xs font-semibold text-muted"><tr><th className="px-4 py-3">Date (UTC)</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Test</th></tr></thead>
          <tbody>{data.map((day) => <tr className="border-t border-border" key={day.date}><th className="px-4 py-3 font-medium text-body">{formatDay(day.date)}</th><td className="px-4 py-3 text-quiz">{day.quizAttempts}</td><td className="px-4 py-3 text-test">{day.testAttempts}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
