import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveRequestIdentity, services } = vi.hoisted(() => ({
  resolveRequestIdentity: vi.fn(),
  services: {
    archiveQuestion: vi.fn(),
    bulkSetQuestionStatus: vi.fn(),
    createQuestion: vi.fn(),
    duplicateQuestion: vi.fn(),
    getQuestion: vi.fn(),
    listQuestions: vi.fn(),
    setQuestionActivity: vi.fn(),
    setQuestionStatus: vi.fn(),
    updateQuestion: vi.fn(),
  },
}));

vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity }));
vi.mock("@/features/questions/service", () => services);

import { GET as list, POST as create } from "@/app/api/v1/admin/questions/route";
import { GET as get, PATCH as update } from "@/app/api/v1/admin/questions/[id]/route";
import { POST as archive } from "@/app/api/v1/admin/questions/[id]/archive/route";
import { PATCH as updateStatus } from "@/app/api/v1/admin/questions/[id]/status/route";

const questionId = crypto.randomUUID();
const topicId = crypto.randomUUID();
const routeContext = { params: Promise.resolve({ id: questionId }) };
const profile = { id: crypto.randomUUID(), role: "ADMIN", isActive: true };

function bearerAdmin() {
  resolveRequestIdentity.mockResolvedValue({ profile, user: {}, mode: "bearer" });
}

function jsonRequest(url: string, method: string, body: unknown, headers?: HeadersInit) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function requireResponse(response: Response | undefined) {
  expect(response).toBeDefined();
  if (!response) throw new Error("Route did not return a response.");
  return response;
}

describe("admin question collection routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.listQuestions.mockResolvedValue({ items: [{ id: questionId }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    services.createQuestion.mockResolvedValue({ id: questionId, status: "DRAFT" });
  });

  it("returns 401 before dispatch when authentication is absent", async () => {
    resolveRequestIdentity.mockResolvedValue(null);

    const response = requireResponse(await list(new Request("https://admin.example/api/v1/admin/questions")));

    expect(response.status).toBe(401);
    expect(services.listQuestions).not.toHaveBeenCalled();
  });

  it("rejects an unsafe cookie mutation origin with 403", async () => {
    resolveRequestIdentity.mockResolvedValue({ profile, user: {}, mode: "cookie" });
    const request = jsonRequest("https://admin.example/api/v1/admin/questions", "POST", {}, {
      host: "admin.example",
      origin: "https://evil.example",
    });

    const response = requireResponse(await create(request));

    expect(response.status).toBe(403);
    expect(services.createQuestion).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid create input without dispatching", async () => {
    bearerAdmin();

    const response = requireResponse(await create(jsonRequest("https://admin.example/api/v1/admin/questions", "POST", {
      topicId,
      assessmentType: "QUIZ",
      questionText: "Question",
      explanation: "Explanation",
      options: [{ optionText: "Only one", isCorrect: true }],
    })));

    expect(response.status).toBe(400);
    expect(services.createQuestion).not.toHaveBeenCalled();
  });

  it("parses list filters and dispatches to the service", async () => {
    bearerAdmin();

    const response = requireResponse(await list(new Request("https://admin.example/api/v1/admin/questions?assessmentType=TEST&isActive=true")));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: questionId }]);
    expect(services.listQuestions).toHaveBeenCalledWith(expect.objectContaining({ assessmentType: "TEST", isActive: true, page: 1, pageSize: 20 }));
  });

  it("validates create input and passes actor context to the service", async () => {
    bearerAdmin();
    const input = {
      topicId,
      assessmentType: "QUIZ",
      questionText: "Question",
      explanation: "Explanation",
      options: [
        { optionText: "Correct", isCorrect: true },
        { optionText: "Incorrect", isCorrect: false },
      ],
    };

    const response = requireResponse(await create(jsonRequest("https://admin.example/api/v1/admin/questions", "POST", input)));

    expect(response.status).toBe(201);
    expect(services.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining(input),
      expect.objectContaining({ actorId: profile.id, requestId: expect.any(String) }),
    );
  });
});

describe("admin question item and lifecycle routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bearerAdmin();
    services.getQuestion.mockResolvedValue({ id: questionId });
    services.updateQuestion.mockResolvedValue({ id: questionId, questionText: "Updated" });
    services.setQuestionStatus.mockResolvedValue({ id: questionId, status: "PUBLISHED" });
    services.archiveQuestion.mockResolvedValue({ id: questionId, status: "ARCHIVED" });
  });

  it("dispatches item reads and updates using the route ID", async () => {
    const getResponse = requireResponse(await get(new Request(`https://admin.example/api/v1/admin/questions/${questionId}`), routeContext));
    const updateResponse = requireResponse(await update(
      jsonRequest(`https://admin.example/api/v1/admin/questions/${questionId}`, "PATCH", { questionText: "Updated" }),
      routeContext,
    ));

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(services.getQuestion).toHaveBeenCalledWith(questionId);
    expect(services.updateQuestion).toHaveBeenCalledWith(
      questionId,
      { questionText: "Updated" },
      expect.objectContaining({ actorId: profile.id }),
    );
  });

  it("rejects invalid lifecycle input without dispatching", async () => {
    const response = requireResponse(await updateStatus(
      jsonRequest(`https://admin.example/api/v1/admin/questions/${questionId}/status`, "PATCH", { status: "ARCHIVED" }),
      routeContext,
    ));

    expect(response.status).toBe(400);
    expect(services.setQuestionStatus).not.toHaveBeenCalled();
  });

  it("dispatches status and archive lifecycle operations", async () => {
    const statusResponse = requireResponse(await updateStatus(
      jsonRequest(`https://admin.example/api/v1/admin/questions/${questionId}/status`, "PATCH", { status: "PUBLISHED" }),
      routeContext,
    ));
    const archiveResponse = requireResponse(await archive(
      new Request(`https://admin.example/api/v1/admin/questions/${questionId}/archive`, { method: "POST" }),
      routeContext,
    ));

    expect(statusResponse.status).toBe(200);
    expect(archiveResponse.status).toBe(200);
    expect(services.setQuestionStatus).toHaveBeenCalledWith(questionId, "PUBLISHED", expect.objectContaining({ actorId: profile.id }));
    expect(services.archiveQuestion).toHaveBeenCalledWith(questionId, expect.objectContaining({ actorId: profile.id }));
  });
});
