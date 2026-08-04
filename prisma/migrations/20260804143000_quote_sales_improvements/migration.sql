ALTER TABLE "Quote"
ADD COLUMN "viewedAt" TIMESTAMP(3),
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "QuoteApprovalRequest"
ADD COLUMN "viewedAt" TIMESTAMP(3),
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "QuoteEnvironmentImage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "environmentName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "caption" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "securityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "securityDetails" TEXT,
    "securityCheckedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteEnvironmentImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteEnvironmentImage_url_key" ON "QuoteEnvironmentImage"("url");
CREATE INDEX "QuoteEnvironmentImage_groupId_environmentName_position_idx" ON "QuoteEnvironmentImage"("groupId", "environmentName", "position");

ALTER TABLE "QuoteEnvironmentImage"
ADD CONSTRAINT "QuoteEnvironmentImage_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "QuoteGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
