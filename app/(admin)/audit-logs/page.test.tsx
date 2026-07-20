import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listAuditLogs: vi.fn() }));

vi.mock("@/features/audit/service", () => ({ listAuditLogs: mocks.listAuditLogs }));

import AuditLogsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAuditLogs.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  });
});

test("forwards dashboard entity type and ID filters to the audit query", async () => {
  render(await AuditLogsPage({
    searchParams: Promise.resolve({ entityType: "CONTENT_LESSON", entityId: "lesson/id" }),
  }));

  expect(mocks.listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
    entityType: "CONTENT_LESSON",
    entityId: "lesson/id",
  }));
  expect(screen.getByText("No audit entries found")).toBeVisible();
});
