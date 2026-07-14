import { render, screen, within } from "@testing-library/react";
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
  it("renders zero data without implying missing activity or content", () => {
    render(<AdminDashboard data={dashboard()} />);

    expect(screen.getAllByTestId("dashboard-metric")).toHaveLength(10);
    expect(screen.getByText("No attempts recorded in this range.")).toBeVisible();
    expect(screen.getByText("No organ systems available")).toBeVisible();
    expect(screen.getByText("No recent learners")).toBeVisible();
    expect(screen.getByText("No recent feedback")).toBeVisible();
    expect(screen.getByText("No recent admin activity")).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("keeps chart meaning readable as a summary and data table", () => {
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
    const table = screen.getByRole("table", { name: "Attempts trend data" });
    expect(within(table).getByText("Jul 8, 2026")).toBeVisible();
    expect(within(table).getAllByText("2")).toHaveLength(1);
    expect(screen.getByText("8 / 10 (80%)")).toBeVisible();
    expect(screen.getByText("3 / 5 (60%)")).toBeVisible();
  });

  it("offers only the supported dashboard ranges and marks the current one", () => {
    render(<AdminDashboard data={dashboard()} />);

    expect(screen.getByRole("link", { name: "7 days" })).toHaveAttribute("href", "/dashboard?days=7");
    expect(screen.getByRole("link", { name: "30 days" })).toHaveAttribute("href", "/dashboard?days=30");
    expect(screen.getByRole("link", { name: "90 days" })).toHaveAttribute("href", "/dashboard?days=90");
    expect(screen.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
  });

  it("uses readable activity labels and safe application links", () => {
    const learnerId = "11111111-1111-4111-8111-111111111111";
    const entityId = "22222222-2222-4222-8222-222222222222";
    render(<AdminDashboard data={dashboard({
      recentRegistrations: [{ id: learnerId, fullName: "Ada Learner", email: "ada@example.com", isActive: true, createdAt: new Date("2026-07-14T10:00:00.000Z") }],
      recentAudit: [{ id: "33333333-3333-4333-8333-333333333333", action: "PUBLISH", entityType: "CONTENT_LESSON", entityId, createdAt: new Date("2026-07-14T11:00:00.000Z"), actor: { id: "44444444-4444-4444-8444-444444444444", fullName: "Admin User" } }],
    })} />);

    expect(screen.getByRole("link", { name: "Ada Learner" })).toHaveAttribute("href", `/users/${learnerId}`);
    expect(screen.getByRole("link", { name: "Publish Content Lesson" })).toHaveAttribute("href", "/audit-logs");
    expect(screen.queryByText(entityId)).not.toBeInTheDocument();
  });
});
