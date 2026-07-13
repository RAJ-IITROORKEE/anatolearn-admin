-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'TEST');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'AUTO_SUBMITTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('GENERAL', 'BUG_REPORT', 'QUESTION_REQUEST', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DAILY_STUDY', 'TEST_REMINDER', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "StorageVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'PUBLISH', 'ARCHIVE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'LOGIN', 'PASSWORD_CHANGE', 'ROLE_CHANGE', 'SCHEDULE', 'CANCEL', 'SEND', 'REVIEW', 'RESOLVE');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "avatarMediaId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganSystem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "longDescription" TEXT,
    "coverImageUrl" TEXT,
    "coverMediaId" UUID,
    "iconImageUrl" TEXT,
    "iconMediaId" UUID,
    "displayOrder" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrganSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL,
    "organSystemId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "coverImageUrl" TEXT,
    "coverMediaId" UUID,
    "displayOrder" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentLesson" (
    "id" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "contentBlocks" JSONB NOT NULL,
    "estimatedReadingMinutes" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentLessonProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contentLessonId" UUID NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "lastViewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "frontText" TEXT NOT NULL,
    "backText" TEXT NOT NULL,
    "frontImageUrl" TEXT,
    "frontMediaId" UUID,
    "backImageUrl" TEXT,
    "backMediaId" UUID,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL,
    "questionText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "mediaId" UUID,
    "explanation" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "conceptTag" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "optionText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "mediaId" UUID,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL,
    "organSystemId" UUID NOT NULL,
    "requestedQuestionCount" INTEGER NOT NULL,
    "totalQuestionCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL,
    "scorePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "timeLimitSeconds" INTEGER,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "retakeSourceId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttemptTopic" (
    "attemptId" UUID NOT NULL,
    "topicId" UUID NOT NULL,

    CONSTRAINT "AssessmentAttemptTopic_pkey" PRIMARY KEY ("attemptId","topicId")
);

-- CreateTable
CREATE TABLE "AttemptQuestion" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "sourceQuestionId" UUID,
    "sourceQuestionSnapshotId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "questionTextSnapshot" TEXT NOT NULL,
    "imageUrlSnapshot" TEXT,
    "explanationSnapshot" TEXT NOT NULL,
    "optionsSnapshot" JSONB NOT NULL,
    "correctOptionKey" UUID NOT NULL,
    "answeredOptionKey" UUID,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMPTZ(3),
    "timeSpentSeconds" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "flashcardId" UUID NOT NULL,
    "viewedCount" INTEGER NOT NULL DEFAULT 0,
    "isDifficult" BOOLEAN NOT NULL DEFAULT false,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "lastViewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FlashcardProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardViewEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "flashcardId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "viewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashcardViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "contentCompletionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "flashcardCompletionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quizAccuracyPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "testAccuracyPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "type" "FeedbackType" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentMediaId" UUID,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetFilter" JSONB NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "deviceTokenId" UUID,
    "tokenSnapshot" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerReceiptId" TEXT,
    "providerErrorCode" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visibility" "StorageVisibility" NOT NULL DEFAULT 'PRIVATE',
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_emailNormalized_key" ON "Profile"("emailNormalized");

-- CreateIndex
CREATE INDEX "Profile_role_isActive_idx" ON "Profile"("role", "isActive");

-- CreateIndex
CREATE INDEX "Profile_createdAt_idx" ON "Profile"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganSystem_name_key" ON "OrganSystem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OrganSystem_slug_key" ON "OrganSystem"("slug");

-- CreateIndex
CREATE INDEX "OrganSystem_status_isActive_displayOrder_id_idx" ON "OrganSystem"("status", "isActive", "displayOrder", "id");

-- CreateIndex
CREATE INDEX "Topic_organSystemId_status_displayOrder_id_idx" ON "Topic"("organSystemId", "status", "displayOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_organSystemId_slug_key" ON "Topic"("organSystemId", "slug");

-- CreateIndex
CREATE INDEX "ContentLesson_topicId_status_displayOrder_id_idx" ON "ContentLesson"("topicId", "status", "displayOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLesson_topicId_slug_key" ON "ContentLesson"("topicId", "slug");

-- CreateIndex
CREATE INDEX "ContentLessonProgress_userId_completedAt_idx" ON "ContentLessonProgress"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "ContentLessonProgress_contentLessonId_idx" ON "ContentLessonProgress"("contentLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLessonProgress_userId_contentLessonId_key" ON "ContentLessonProgress"("userId", "contentLessonId");

-- CreateIndex
CREATE INDEX "Flashcard_topicId_status_difficulty_displayOrder_id_idx" ON "Flashcard"("topicId", "status", "difficulty", "displayOrder", "id");

-- CreateIndex
CREATE INDEX "Question_assessmentType_topicId_difficulty_status_isActive__idx" ON "Question"("assessmentType", "topicId", "difficulty", "status", "isActive", "id");

-- CreateIndex
CREATE INDEX "QuestionOption_mediaId_idx" ON "QuestionOption"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_key_key" ON "QuestionOption"("questionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_label_key" ON "QuestionOption"("questionId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_displayOrder_key" ON "QuestionOption"("questionId", "displayOrder");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_assessmentType_completedAt_id_idx" ON "AssessmentAttempt"("userId", "assessmentType", "completedAt", "id");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_organSystemId_idx" ON "AssessmentAttempt"("organSystemId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_status_expiresAt_idx" ON "AssessmentAttempt"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_retakeSourceId_idx" ON "AssessmentAttempt"("retakeSourceId");

-- CreateIndex
CREATE INDEX "AssessmentAttemptTopic_topicId_idx" ON "AssessmentAttemptTopic"("topicId");

-- CreateIndex
CREATE INDEX "AttemptQuestion_sourceQuestionId_idx" ON "AttemptQuestion"("sourceQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptQuestion_attemptId_displayOrder_key" ON "AttemptQuestion"("attemptId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptQuestion_attemptId_sourceQuestionSnapshotId_key" ON "AttemptQuestion"("attemptId", "sourceQuestionSnapshotId");

-- CreateIndex
CREATE INDEX "FlashcardProgress_flashcardId_idx" ON "FlashcardProgress"("flashcardId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardProgress_userId_flashcardId_key" ON "FlashcardProgress"("userId", "flashcardId");

-- CreateIndex
CREATE INDEX "FlashcardViewEvent_flashcardId_viewedAt_idx" ON "FlashcardViewEvent"("flashcardId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardViewEvent_userId_eventId_key" ON "FlashcardViewEvent"("userId", "eventId");

-- CreateIndex
CREATE INDEX "TopicProgress_topicId_idx" ON "TopicProgress"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicProgress_userId_topicId_key" ON "TopicProgress"("userId", "topicId");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_reviewedById_idx" ON "Feedback"("reviewedById");

-- CreateIndex
CREATE INDEX "Feedback_attachmentMediaId_idx" ON "Feedback"("attachmentMediaId");

-- CreateIndex
CREATE INDEX "NotificationCampaign_status_scheduledAt_idx" ON "NotificationCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_createdById_idx" ON "NotificationCampaign"("createdById");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_readAt_createdAt_idx" ON "NotificationRecipient"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_campaignId_userId_key" ON "NotificationRecipient"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipientId_status_idx" ON "NotificationDelivery"("recipientId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_deviceTokenId_idx" ON "NotificationDelivery"("deviceTokenId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_providerReceiptId_idx" ON "NotificationDelivery"("providerReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_expoPushToken_key" ON "DeviceToken"("expoPushToken");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_isActive_idx" ON "DeviceToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "MediaAsset_mimeType_idx" ON "MediaAsset"("mimeType");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "MediaAsset_archivedAt_idx" ON "MediaAsset"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_bucket_path_key" ON "MediaAsset"("bucket", "path");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganSystem" ADD CONSTRAINT "OrganSystem_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganSystem" ADD CONSTRAINT "OrganSystem_iconMediaId_fkey" FOREIGN KEY ("iconMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_organSystemId_fkey" FOREIGN KEY ("organSystemId") REFERENCES "OrganSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLesson" ADD CONSTRAINT "ContentLesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLessonProgress" ADD CONSTRAINT "ContentLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLessonProgress" ADD CONSTRAINT "ContentLessonProgress_contentLessonId_fkey" FOREIGN KEY ("contentLessonId") REFERENCES "ContentLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_frontMediaId_fkey" FOREIGN KEY ("frontMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_backMediaId_fkey" FOREIGN KEY ("backMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_organSystemId_fkey" FOREIGN KEY ("organSystemId") REFERENCES "OrganSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_retakeSourceId_fkey" FOREIGN KEY ("retakeSourceId") REFERENCES "AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttemptTopic" ADD CONSTRAINT "AssessmentAttemptTopic_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttemptTopic" ADD CONSTRAINT "AssessmentAttemptTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_sourceQuestionId_fkey" FOREIGN KEY ("sourceQuestionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardViewEvent" ADD CONSTRAINT "FlashcardViewEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardViewEvent" ADD CONSTRAINT "FlashcardViewEvent_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_attachmentMediaId_fkey" FOREIGN KEY ("attachmentMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NotificationRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_deviceTokenId_fkey" FOREIGN KEY ("deviceTokenId") REFERENCES "DeviceToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application invariants that Prisma cannot express directly.
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_emailNormalized_normalized_check"
  CHECK ("emailNormalized" = lower(btrim("emailNormalized")));
ALTER TABLE "OrganSystem" ADD CONSTRAINT "OrganSystem_displayOrder_nonnegative_check"
  CHECK ("displayOrder" >= 0);
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_displayOrder_nonnegative_check"
  CHECK ("displayOrder" >= 0);
ALTER TABLE "ContentLesson" ADD CONSTRAINT "ContentLesson_values_nonnegative_check"
  CHECK ("displayOrder" >= 0 AND "estimatedReadingMinutes" >= 0);
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_displayOrder_nonnegative_check"
  CHECK ("displayOrder" >= 0);
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_displayOrder_nonnegative_check"
  CHECK ("displayOrder" >= 0);
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_question_counts_check"
  CHECK (
    "requestedQuestionCount" BETWEEN 5 AND 50
    AND "totalQuestionCount" BETWEEN 5 AND 50
    AND "correctCount" >= 0
    AND "incorrectCount" >= 0
    AND "unansweredCount" >= 0
    AND "correctCount" + "incorrectCount" + "unansweredCount" = "totalQuestionCount"
  );
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_score_check"
  CHECK ("scorePercentage" BETWEEN 0 AND 100 AND ("durationSeconds" IS NULL OR "durationSeconds" >= 0));
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_timing_check"
  CHECK (
    ("assessmentType" = 'QUIZ' AND "timeLimitSeconds" IS NULL AND "expiresAt" IS NULL)
    OR
    ("assessmentType" = 'TEST' AND "timeLimitSeconds" = "totalQuestionCount" * 60 AND "expiresAt" IS NOT NULL)
  );
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_retake_not_self_check"
  CHECK ("retakeSourceId" IS NULL OR "retakeSourceId" <> "id");
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_answer_consistency_check"
  CHECK (
    ("answeredOptionKey" IS NULL AND "answeredAt" IS NULL AND "isCorrect" IS NULL)
    OR
    ("answeredOptionKey" IS NOT NULL AND "answeredAt" IS NOT NULL AND "isCorrect" IS NOT NULL)
  );
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_values_nonnegative_check"
  CHECK ("displayOrder" >= 0 AND ("timeSpentSeconds" IS NULL OR "timeSpentSeconds" >= 0));
ALTER TABLE "FlashcardProgress" ADD CONSTRAINT "FlashcardProgress_viewedCount_nonnegative_check"
  CHECK ("viewedCount" >= 0);
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_percentages_check"
  CHECK (
    "contentCompletionPercent" BETWEEN 0 AND 100
    AND "flashcardCompletionPercent" BETWEEN 0 AND 100
    AND "quizAccuracyPercent" BETWEEN 0 AND 100
    AND "testAccuracyPercent" BETWEEN 0 AND 100
  );
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_review_consistency_check"
  CHECK (
    ("status" = 'NEW' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL)
    OR
    ("status" <> 'NEW' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  );
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_metadata_check"
  CHECK (
    "byteSize" > 0
    AND (("width" IS NULL AND "height" IS NULL) OR ("width" > 0 AND "height" > 0))
    AND length(btrim("altText")) > 0
  );

CREATE UNIQUE INDEX "QuestionOption_one_correct_per_question_idx"
  ON "QuestionOption" ("questionId") WHERE "isCorrect" = true;
CREATE INDEX "AssessmentAttempt_due_for_expiry_idx"
  ON "AssessmentAttempt" ("expiresAt") WHERE "status" = 'IN_PROGRESS' AND "expiresAt" IS NOT NULL;
CREATE INDEX "NotificationCampaign_due_idx"
  ON "NotificationCampaign" ("scheduledAt") WHERE "status" = 'SCHEDULED';
CREATE INDEX "NotificationRecipient_unread_idx"
  ON "NotificationRecipient" ("userId", "createdAt" DESC) WHERE "readAt" IS NULL;
CREATE INDEX "NotificationDelivery_pending_idx"
  ON "NotificationDelivery" ("createdAt") WHERE "status" = 'PENDING';

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog rows are append-only';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION enforce_attempt_topic_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "AssessmentAttempt" attempt
    JOIN "Topic" topic ON topic."id" = NEW."topicId"
    WHERE attempt."id" = NEW."attemptId"
      AND attempt."organSystemId" = topic."organSystemId"
  ) THEN
    RAISE EXCEPTION 'Attempt topic must belong to the attempt organ system';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AssessmentAttemptTopic_scope"
BEFORE INSERT OR UPDATE ON "AssessmentAttemptTopic"
FOR EACH ROW EXECUTE FUNCTION enforce_attempt_topic_scope();
