ALTER TABLE "ProjectContract"
  ALTER COLUMN "projectId" DROP NOT NULL,
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "standaloneTitle" TEXT;

CREATE INDEX "ProjectContract_clientId_status_idx"
  ON "ProjectContract"("clientId", "status");

CREATE INDEX "ProjectContract_createdById_status_idx"
  ON "ProjectContract"("createdById", "status");

ALTER TABLE "ProjectContract"
  ADD CONSTRAINT "ProjectContract_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
