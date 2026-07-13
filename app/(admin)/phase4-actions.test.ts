import { expect, test } from "vitest";

import { createQuestionAction } from "./phase4-actions";

test("question action rejects an invalid option set before authentication or service calls", async () => {
  const data = new FormData();
  data.set("assessmentType", "QUIZ");
  data.set("topicId", "not-a-topic-id");
  data.set("questionText", "Question?");
  data.set("explanation", "Explanation");
  data.set("difficulty", "MEDIUM");
  data.set("optionCount", "1");
  data.set("correctOption", "0");
  data.set("optionText.0", "Only option");

  const result = await createQuestionAction({}, data);

  expect(result.error).toBeTruthy();
});
