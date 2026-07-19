import { QuestionError, assertOptionSet } from "./domain";

type QuestionWithOptions = {
  id: string;
  topicId: string;
  assessmentType: "QUIZ" | "TEST";
  questionText: string;
  imageUrl: string | null;
  mediaId: string | null;
  explanation: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  conceptTag: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  topic?: { title: string };
  options: Array<{
    id: string;
    key: string;
    label: string;
    displayOrder: number;
    optionText: string;
    imageUrl: string | null;
    mediaId: string | null;
    isCorrect: boolean;
  }>;
};

export function questionDto(value: QuestionWithOptions) {
  const options = [...value.options].sort((left, right) => left.displayOrder - right.displayOrder);
  try {
    assertOptionSet(options);
  } catch {
    throw new QuestionError("INVALID_STORED_QUESTION", "Question has invalid options.", 500);
  }
  if (options.some((option, index) => option.displayOrder !== index + 1 || option.label !== String.fromCharCode(65 + index))) {
    throw new QuestionError("INVALID_STORED_QUESTION", "Question has invalid option ordering.", 500);
  }
  return {
    id: value.id,
    topicId: value.topicId,
    topicTitle: value.topic?.title ?? null,
    assessmentType: value.assessmentType,
    questionText: value.questionText,
    imageUrl: value.imageUrl,
    mediaId: value.mediaId,
    explanation: value.explanation,
    difficulty: value.difficulty,
    conceptTag: value.conceptTag,
    status: value.status,
    isActive: value.isActive,
    options: options.map((option) => ({
      id: option.id,
      key: option.key,
      label: option.label,
      displayOrder: option.displayOrder,
      optionText: option.optionText,
      imageUrl: option.imageUrl,
      mediaId: option.mediaId,
      isCorrect: option.isCorrect,
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
