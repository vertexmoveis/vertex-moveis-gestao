ALTER TABLE "Client"
  ADD COLUMN "documentNormalized" TEXT,
  ADD COLUMN "phoneNormalized" TEXT,
  ADD COLUMN "whatsappNormalized" TEXT,
  ADD COLUMN "emailNormalized" TEXT,
  ADD COLUMN "relationshipStage" TEXT NOT NULL DEFAULT 'CONTACT',
  ADD COLUMN "relationshipStageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastCommercialActivityAt" TIMESTAMP(3),
  ADD COLUMN "inactivatedAt" TIMESTAMP(3),
  ADD COLUMN "inactiveReason" TEXT;

UPDATE "Client"
SET
  "documentNormalized" = NULLIF(regexp_replace(COALESCE("document", ''), '[^0-9]', '', 'g'), ''),
  "phoneNormalized" = NULLIF(regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g'), ''),
  "whatsappNormalized" = NULLIF(regexp_replace(COALESCE("whatsapp", ''), '[^0-9]', '', 'g'), ''),
  "emailNormalized" = NULLIF(lower(trim(COALESCE("email", ''))), '');

UPDATE "Client" AS client
SET
  "relationshipStage" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "Project" AS project
      WHERE project."clientId" = client."id"
        AND project."archivedAt" IS NULL
    ) OR EXISTS (
      SELECT 1
      FROM "Quote" AS quote
      WHERE quote."clientId" = client."id"
        AND quote."archivedAt" IS NULL
        AND quote."status" IN ('APPROVED', 'SOLD')
    ) THEN 'CUSTOMER'
    WHEN EXISTS (
      SELECT 1
      FROM "Quote" AS quote
      WHERE quote."clientId" = client."id"
        AND quote."archivedAt" IS NULL
        AND quote."status" IN ('DRAFT', 'SENT', 'WAITING_APPROVAL')
    ) THEN 'NEGOTIATING'
    WHEN EXISTS (
      SELECT 1
      FROM "Quote" AS quote
      WHERE quote."clientId" = client."id"
        AND quote."archivedAt" IS NULL
    ) THEN 'INACTIVE'
    ELSE 'CONTACT'
  END,
  "relationshipStageChangedAt" = client."updatedAt",
  "lastCommercialActivityAt" = COALESCE(
    (
      SELECT MAX(quote."updatedAt")
      FROM "Quote" AS quote
      WHERE quote."clientId" = client."id"
        AND quote."archivedAt" IS NULL
    ),
    client."updatedAt"
  );

UPDATE "Client"
SET
  "inactivatedAt" = "lastCommercialActivityAt",
  "inactiveReason" = 'Negociação encerrada'
WHERE "relationshipStage" = 'INACTIVE';

ALTER TABLE "CompanyProfile"
  ADD COLUMN "quoteReminderDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "leadNoResponseDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "leadCloseSuggestionDays" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "Project" DROP CONSTRAINT "Project_clientId_fkey";
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote" DROP CONSTRAINT "Quote_clientId_fkey";
ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuoteGroup" DROP CONSTRAINT "QuoteGroup_clientId_fkey";
ALTER TABLE "QuoteGroup"
  ADD CONSTRAINT "QuoteGroup_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Client_documentNormalized_idx" ON "Client"("documentNormalized");
CREATE INDEX "Client_phoneNormalized_idx" ON "Client"("phoneNormalized");
CREATE INDEX "Client_whatsappNormalized_idx" ON "Client"("whatsappNormalized");
CREATE INDEX "Client_emailNormalized_idx" ON "Client"("emailNormalized");
CREATE INDEX "Client_relationshipStage_archivedAt_idx" ON "Client"("relationshipStage", "archivedAt");
CREATE INDEX "Client_managerId_relationshipStage_archivedAt_idx" ON "Client"("managerId", "relationshipStage", "archivedAt");
CREATE INDEX "Client_lastCommercialActivityAt_idx" ON "Client"("lastCommercialActivityAt");
