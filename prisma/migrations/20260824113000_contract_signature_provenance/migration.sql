ALTER TABLE "ProjectContract"
  ADD COLUMN "signatureMethod" TEXT,
  ADD COLUMN "signatureRecordedAt" TIMESTAMP(3),
  ADD COLUMN "signatureRecordedById" TEXT,
  ADD COLUMN "signatureNote" TEXT;

UPDATE "ProjectContract"
SET
  "signatureMethod" = 'DIGITAL',
  "signatureRecordedAt" = COALESCE("signedAt", "updatedAt")
WHERE "signedAt" IS NOT NULL;

CREATE INDEX "ProjectContract_signatureRecordedById_idx"
  ON "ProjectContract"("signatureRecordedById");

ALTER TABLE "ProjectContract"
  ADD CONSTRAINT "ProjectContract_signatureRecordedById_fkey"
  FOREIGN KEY ("signatureRecordedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
