import type { DashboardMetric } from "./domain";

export type AdminDashboardDto = {
  generatedAt: Date;
  range: { days: 7 | 30 | 90; start: Date; endExclusive: Date };
  counts: {
    totalUsers: number;
    activeUsers: number;
    organSystems: number;
    topics: number;
    flashcards: number;
    questions: number;
    publishedLessons: number;
    quizQuestions: number;
    testQuestions: number;
    newFeedback: number;
    completedQuizzes: number;
    completedTests: number;
  };
  accuracy: { quiz: DashboardMetric; test: DashboardMetric };
  attemptsTrend: Array<{ date: string; quizAttempts: number; testAttempts: number }>;
  contentReadinessCriteria: {
    denominator: "NON_ARCHIVED_TOPICS";
    completeTopicRequires: [
      "PUBLISHED_ACTIVE_SYSTEM_AND_PUBLISHED_TOPIC",
      "ELIGIBLE_PUBLISHED_LESSON",
      "ELIGIBLE_PUBLISHED_FLASHCARD",
      "ELIGIBLE_ACTIVE_PUBLISHED_QUIZ_QUESTION",
      "ELIGIBLE_ACTIVE_PUBLISHED_TEST_QUESTION",
    ];
  };
  contentCompleteness: Array<{
    id: string;
    name: string;
    displayOrder: number;
    completeTopics: DashboardMetric;
    lessons: DashboardMetric;
    flashcards: DashboardMetric;
    quizQuestions: DashboardMetric;
    testQuestions: DashboardMetric;
  }>;
  recentRegistrations: Array<{
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
  }>;
  recentFeedback: Array<{
    id: string;
    type: string;
    subject: string;
    status: string;
    createdAt: Date;
    user: { id: string; fullName: string; email: string } | null;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    actor: { id: string; fullName: string } | null;
  }>;
};
