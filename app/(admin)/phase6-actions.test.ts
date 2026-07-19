import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(), setLearnerActivity: vi.fn(), updateFeedback: vi.fn(), moveToTrash: vi.fn(), bulkMoveToTrash: vi.fn(), revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock("@/features/users/service", () => ({ setLearnerActivity: mocks.setLearnerActivity }));
vi.mock("@/features/feedback/service", () => ({ updateFeedback: mocks.updateFeedback }));
vi.mock("@/features/trash/service", () => ({ moveToTrash: mocks.moveToTrash, bulkMoveToTrash: mocks.bulkMoveToTrash }));

import { bulkTrashFeedbackAction, changeFeedbackStatusAction, changeUserActivityAction, trashFeedbackAction, updateFeedbackNotesAction } from "./phase6-actions";

describe("Phase 6 server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPage.mockResolvedValue({ profile: { id: crypto.randomUUID() } });
  });

  it("rejects malformed user IDs before authentication", async () => {
    const result = await changeUserActivityAction("bad-id", false, {});
    expect(result.error).toBeTruthy();
    expect(mocks.requireAdminPage).not.toHaveBeenCalled();
  });

  it("changes user activity with a server-derived actor and revalidates user pages", async () => {
    const id = crypto.randomUUID();
    await expect(changeUserActivityAction(id, false, {})).resolves.toEqual({ success: "User deactivated." });
    expect(mocks.setLearnerActivity).toHaveBeenCalledWith(id, false, expect.objectContaining({ actorId: expect.any(String), requestId: expect.any(String) }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users", "layout");
  });

  it("validates and saves private notes", async () => {
    const id = crypto.randomUUID();
    const data = new FormData();
    data.set("adminNotes", "  Internal follow-up  ");
    await expect(updateFeedbackNotesAction(id, {}, data)).resolves.toEqual({ success: "Admin notes saved." });
    expect(mocks.updateFeedback).toHaveBeenCalledWith(id, { adminNotes: "Internal follow-up" }, expect.any(Object));
  });

  it("allows only forward feedback status actions", async () => {
    const id = crypto.randomUUID();
    await expect(changeFeedbackStatusAction(id, "NEW", {})).resolves.toEqual({ error: expect.any(String) });
    expect(mocks.updateFeedback).not.toHaveBeenCalled();
  });

  it("moves one feedback item to Trash with a server-derived actor", async () => {
    const id = crypto.randomUUID();
    await expect(trashFeedbackAction(id, {})).resolves.toEqual({ success: "Moved to Trash." });
    expect(mocks.moveToTrash).toHaveBeenCalledWith("feedback", id, expect.objectContaining({ actorId: expect.any(String), requestId: expect.any(String) }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/feedback", "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/trash");
  });

  it("validates and atomically moves the complete feedback selection to Trash", async () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const data = new FormData();
    ids.forEach((id) => data.append("ids", id));

    await expect(bulkTrashFeedbackAction({}, data)).resolves.toEqual({ success: "2 feedback items moved to Trash." });
    expect(mocks.bulkMoveToTrash).toHaveBeenCalledWith("feedback", ids, expect.objectContaining({ actorId: expect.any(String) }));
  });
});
