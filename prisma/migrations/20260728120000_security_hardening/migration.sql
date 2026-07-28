ALTER TABLE "Client"
  ADD COLUMN "managerId" TEXT;

UPDATE "Client" AS client
SET "managerId" = (
  SELECT project."managerId"
  FROM "Project" AS project
  WHERE project."clientId" = client."id"
    AND project."managerId" IS NOT NULL
    AND project."archivedAt" IS NULL
  ORDER BY project."updatedAt" DESC
  LIMIT 1
)
WHERE client."managerId" IS NULL;

UPDATE "Client" AS client
SET "managerId" = (
  SELECT quote."createdById"
  FROM "Quote" AS quote
  WHERE quote."clientId" = client."id"
    AND quote."createdById" IS NOT NULL
    AND quote."archivedAt" IS NULL
  ORDER BY quote."updatedAt" DESC
  LIMIT 1
)
WHERE client."managerId" IS NULL;

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Client_managerId_idx" ON "Client"("managerId");
CREATE INDEX "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

UPDATE "ProjectFile"
SET
  "securityStatus" = 'ERROR',
  "securityDetails" = 'PDF mantido em quarentena até a configuração do antivírus externo.'
WHERE "type" = 'application/pdf'
  AND "securityStatus" = 'TYPE_CHECKED';
