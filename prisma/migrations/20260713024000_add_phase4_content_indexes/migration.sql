-- Add reverse-reference and administration indexes used by Phase 4 media and list queries.
CREATE INDEX "Flashcard_frontMediaId_idx" ON "Flashcard"("frontMediaId");
CREATE INDEX "Flashcard_backMediaId_idx" ON "Flashcard"("backMediaId");
CREATE INDEX "Flashcard_status_difficulty_updatedAt_id_idx" ON "Flashcard"("status", "difficulty", "updatedAt", "id");

CREATE INDEX "Question_mediaId_idx" ON "Question"("mediaId");
CREATE INDEX "Question_assessmentType_status_isActive_updatedAt_id_idx" ON "Question"("assessmentType", "status", "isActive", "updatedAt", "id");
