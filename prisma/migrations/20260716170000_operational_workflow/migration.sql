-- Improve operational visibility while keeping existing project data intact.
ALTER TABLE "InstallationSchedule"
  ADD COLUMN "departureAt" TIMESTAMP(3),
  ADD COLUMN "arrivalAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "clientConfirmation" TEXT,
  ADD COLUMN "completionNotes" TEXT;

ALTER TABLE "ProjectFile"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OTHER';

CREATE UNIQUE INDEX "ProjectFile_projectId_url_key" ON "ProjectFile"("projectId", "url");
CREATE INDEX "ProjectFile_projectId_category_idx" ON "ProjectFile"("projectId", "category");
CREATE INDEX "InstallationSchedule_status_scheduledStart_idx" ON "InstallationSchedule"("status", "scheduledStart");
CREATE INDEX "Quote_createdById_status_createdAt_idx" ON "Quote"("createdById", "status", "createdAt");
