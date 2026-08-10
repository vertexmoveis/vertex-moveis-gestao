ALTER TABLE "CompanyPresentationImage"
ADD COLUMN "mediaKind" TEXT NOT NULL DEFAULT 'PORTFOLIO',
ADD COLUMN "pairKey" TEXT;

DROP INDEX IF EXISTS "CompanyPresentationImage_companyId_active_environmentName_position_idx";

CREATE INDEX "CompanyPresentationImage_companyId_active_mediaKind_environmentName_position_idx"
ON "CompanyPresentationImage"("companyId", "active", "mediaKind", "environmentName", "position");
