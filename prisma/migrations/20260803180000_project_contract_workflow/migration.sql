ALTER TABLE "Project"
  ADD COLUMN "contractRequirement" TEXT NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN "contractWaivedAt" TIMESTAMP(3),
  ADD COLUMN "contractWaivedReason" TEXT,
  ADD COLUMN "contractWaivedById" TEXT,
  ADD COLUMN "contractRevisionChanges" JSONB;

UPDATE "Project"
SET "contractRequirement" = 'OPTIONAL_LEGACY'
WHERE "createdAt" < TIMESTAMP '2026-08-03 03:00:00';

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_contractWaivedById_fkey"
  FOREIGN KEY ("contractWaivedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Project_contractRequirement_idx" ON "Project"("contractRequirement");
CREATE INDEX "Project_contractWaivedById_idx" ON "Project"("contractWaivedById");

ALTER TABLE "ProjectContract"
  ADD COLUMN "lastReminderAt" TIMESTAMP(3),
  ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ProjectContract_lastReminderAt_idx" ON "ProjectContract"("lastReminderAt");
