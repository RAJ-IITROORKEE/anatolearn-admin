import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AdminDashboardDto } from "@/features/admin-dashboard/dto";
import { AdminDashboard } from "./admin-dashboard";

function dashboard(overrides: Partial<AdminDashboardDto> = {}): AdminDashboardDto {
  return {
    generatedAt: new Date("2026-07-14T12:00:00.000Z"),
    range: {
      days: 7,
      start: new Date("2026-07-08T00:00:00.000Z"),
      endExclusive: new Date("2026-07-15T00:00:00.000Z"),
    },
    counts: {
      totalUsers: 0,
      activeUsers: 0,
      organSystems: 0,
      topics: 0,
      flashcards: 0,
      questions: 0,
      publishedLessons: 0,
      quizQuestions: 0,
      testQuestions: 0,
      newFeedback: 0,
      completedQuizzes: 0,
      completedTests: 0,
    },
    accuracy: {
      quiz: { numerator: 0, denominator: 0, percentage: 0 },
      test: { numerator: 0, denominator: 0, percentage: 0 },
    },
    attemptsTrend: [
      { date: "2026-07-08", quizAttempts: 0, testAttempts: 0 },
      { date: "2026-07-09", quizAttempts: 0, testAttempts: 0 },
    ],
    contentReadinessCriteria: {
      denominator: "NON_ARCHIVED_TOPICS",
      completeTopicRequires: [
        "PUBLISHED_ACTIVE_SYSTEM_AND_PUBLISHED_TOPIC",
        "ELIGIBLE_PUBLISHED_LESSON",
        "ELIGIBLE_PUBLISHED_FLASHCARD",
        "ELIGIBLE_ACTIVE_PUBLISHED_QUIZ_QUESTION",
        "ELIGIBLE_ACTIVE_PUBLISHED_TEST_QUESTION",
      ],
    },
    contentCompleteness: [],
    recentRegistrations: [],
    recentFeedback: [],
    recentAudit: [],
    ...overrides,
  };
}

describe("AdminDashboard", () => {
  it("renders truthful zero states without invalid values", () => {
    render(<AdminDashboard data={dashboard()} />);

    expect(screen.getByText("No attempts recorded in this range.")).toBeVisible();
    expect(screen.getByText("No organ systems available")).toBeVisible();
    expect(screen.getByText("No recent learners")).toBeVisible();
    expect(screen.getByText("No recent feedback")).toBeVisible();
    expect(screen.getByText("No recent admin activity")).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("labels range-based and all-time insights truthfully", () => {
    render(<AdminDashboard data={dashboard({
      counts: {
        ...dashboard().counts,
        totalUsers: 8,
        activeUsers: 6,
        completedQuizzes: 12,
        completedTests: 4,
      },
    })} />);

    expect(screen.getByRole("heading", { name: "All-time overview" })).toBeVisible();
    expect(screen.getByText("Only the attempts trend changes with the selected date range. All other metrics are all time.")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Active learner ratio" })).toHaveAttribute("aria-valuenow", "75");
    const submissions = screen.getByRole("region", { name: "All-time submitted attempts" });
    expect(within(submissions).getByText("12 quizzes")).toBeVisible();
    expect(within(submissions).getByText("4 tests")).toBeVisible();
  });

  it("supports keyboard inspection and exposes an exact daily fallback", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard data={dashboard({
      accuracy: {
        quiz: { numerator: 8, denominator: 10, percentage: 80 },
        test: { numerator: 3, denominator: 5, percentage: 60 },
      },
      attemptsTrend: [
        { date: "2026-07-08", quizAttempts: 2, testAttempts: 1 },
        { date: "2026-07-09", quizAttempts: 3, testAttempts: 4 },
      ],
    })} />);

    expect(screen.getByText("5 quiz attempts and 5 test attempts across 2 days.")).toBeVisible();
    const inspector = screen.getByRole("slider", { name: "Inspect daily attempt values" });
    expect(inspector).toHaveAttribute("aria-valuetext", "Jul 9, 2026: 3 quiz attempts and 4 test attempts");
    inspector.focus();
    await user.keyboard("{Home}{ArrowRight}");
    expect(inspector).toHaveAttribute("aria-valuetext", "Jul 9, 2026: 3 quiz attempts and 4 test attempts");
    await user.keyboard("{ArrowLeft}");
    expect(inspector).toHaveAttribute("aria-valuetext", "Jul 8, 2026: 2 quiz attempts and 1 test attempt");
    expect(screen.getByText("Selected: Jul 8, 2026")).toBeVisible();

    const table = screen.getByRole("table", { name: "Attempts trend data" });
    expect(within(table).getByText("Jul 8, 2026")).toBeVisible();
    expect(within(table).getAllByText("2")).toHaveLength(1);
    expect(screen.getByText("8 / 10 (80%)")).toBeVisible();
    expect(screen.getByText("3 / 5 (60%)")).toBeVisible();
    expect(screen.getByTestId("quiz-trend-line")).not.toHaveAttribute("stroke-dasharray");
    expect(screen.getByTestId("test-trend-line")).toHaveAttribute("stroke-dasharray", "10 7");
  });

  it("offers only the supported dashboard ranges and marks the current one", () => {
    render(<AdminDashboard data={dashboard()} />);

    expect(screen.getByRole("link", { name: "7 days" })).toHaveAttribute("href", "/dashboard?days=7");
    expect(screen.getByRole("link", { name: "30 days" })).toHaveAttribute("href", "/dashboard?days=30");
    expect(screen.getByRole("link", { name: "90 days" })).toHaveAttribute("href", "/dashboard?days=90");
    expect(screen.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
  });

  it("resets chart inspection to the newest day when the range data changes", () => {
    const { rerender } = render(<AdminDashboard data={dashboard({
      attemptsTrend: [
        { date: "2026-07-08", quizAttempts: 1, testAttempts: 0 },
        { date: "2026-07-09", quizAttempts: 2, testAttempts: 0 },
      ],
    })} />);
    expect(screen.getByRole("slider", { name: "Inspect daily attempt values" })).toHaveAttribute("aria-valuetext", "Jul 9, 2026: 2 quiz attempts and 0 test attempts");

    rerender(<AdminDashboard data={dashboard({
      range: {
        days: 30,
        start: new Date("2026-06-15T00:00:00.000Z"),
        endExclusive: new Date("2026-07-15T00:00:00.000Z"),
      },
      attemptsTrend: [
        { date: "2026-07-12", quizAttempts: 1, testAttempts: 0 },
        { date: "2026-07-13", quizAttempts: 2, testAttempts: 0 },
        { date: "2026-07-14", quizAttempts: 3, testAttempts: 0 },
      ],
    })} />);

    expect(screen.getByRole("slider", { name: "Inspect daily attempt values" })).toHaveAttribute("aria-valuetext", "Jul 14, 2026: 3 quiz attempts and 0 test attempts");
  });

  it("names grouped readiness bars and keeps their exact values visible", () => {
    render(<AdminDashboard data={dashboard({
      contentCompleteness: [{
        id: "cardiovascular",
        name: "Cardiovascular",
        displayOrder: 1,
        completeTopics: { numerator: 1, denominator: 2, percentage: 50 },
        lessons: { numerator: 2, denominator: 2, percentage: 100 },
        flashcards: { numerator: 1, denominator: 2, percentage: 50 },
        quizQuestions: { numerator: 1, denominator: 2, percentage: 50 },
        testQuestions: { numerator: 0, denominator: 2, percentage: 0 },
      }],
    })} />);

    const system = screen.getByRole("article", { name: "Cardiovascular content readiness" });
    const quiz = within(system).getByRole("progressbar", { name: "Cardiovascular quiz readiness" });
    expect(quiz).toHaveAttribute("aria-valuenow", "50");
    expect(within(quiz.parentElement as HTMLElement).getByText("1/2 · 50%", { selector: "span" })).toBeVisible();
  });

  it("renders five polished rows per activity panel with safe links", () => {
    const recentRegistrations = Array.from({ length: 6 }, (_, index) => ({
      id: `learner/${index}`,
      fullName: `Learner ${index + 1}`,
      email: `learner${index + 1}@example.com`,
      isActive: index !== 4,
      createdAt: new Date(`2026-07-${14 - index}T10:00:00.000Z`),
    }));
    const recentFeedback = Array.from({ length: 6 }, (_, index) => ({
      id: `feedback/${index}`,
      type: "IMPROVEMENT",
      subject: `Feedback ${index + 1}`,
      status: index === 0 ? "NEW" : "REVIEWED",
      createdAt: new Date(`2026-07-${14 - index}T11:00:00.000Z`),
      user: null,
    }));
    const recentAudit = Array.from({ length: 6 }, (_, index) => ({
      id: `audit-${index}`,
      action: "PUBLISH",
      entityType: "CONTENT_LESSON",
      entityId: `entity/${index}`,
      createdAt: new Date(`2026-07-${14 - index}T12:00:00.000Z`),
      actor: { id: `admin-${index}`, fullName: "Admin User" },
    }));
    render(<AdminDashboard data={dashboard({
      recentRegistrations,
      recentFeedback,
      recentAudit,
    })} />);

    const learners = screen.getByRole("region", { name: "Recent learners" });
    const feedback = screen.getByRole("region", { name: "Recent feedback" });
    const audit = screen.getByRole("region", { name: "Recent admin activity" });
    expect(within(learners).getAllByRole("listitem")).toHaveLength(5);
    expect(within(feedback).getAllByRole("listitem")).toHaveLength(5);
    expect(within(audit).getAllByRole("listitem")).toHaveLength(5);
    expect(within(learners).getByRole("link", { name: "Learner 1" })).toHaveAttribute("href", "/users/learner%2F0");
    expect(within(feedback).getByRole("link", { name: "Feedback 1" })).toHaveAttribute("href", "/feedback/feedback%2F0");
    expect(within(audit).getAllByRole("link", { name: "Publish Content Lesson" })[0]).toHaveAttribute(
      "href",
      "/audit-logs?entityType=CONTENT_LESSON&entityId=entity%2F0",
    );
    expect(within(audit).getByRole("link", { name: "Show all recent activities" })).toHaveAttribute("href", "/audit-logs");
    expect(screen.queryByText("Learner 6")).not.toBeInTheDocument();
    expect(screen.queryByText("entity/0")).not.toBeInTheDocument();
  });
});
