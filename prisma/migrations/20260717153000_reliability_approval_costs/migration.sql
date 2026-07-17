ALTER TABLE "Quote"
ADD COLUMN "cardFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "cardFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "QuoteApprovalRequest"
ADD COLUMN "invalidatedAt" TIMESTAMP(3),
ADD COLUMN "snapshot" TEXT,
ADD COLUMN "revisionVersion" INTEGER,
ADD COLUMN "responseIpHash" TEXT,
ADD COLUMN "responseUserAgent" TEXT,
ADD COLUMN "responseNote" TEXT;

CREATE INDEX "QuoteApprovalRequest_invalidatedAt_idx" ON "QuoteApprovalRequest"("invalidatedAt");

CREATE TABLE "SystemEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "source" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemEvent_type_createdAt_idx" ON "SystemEvent"("type", "createdAt");
CREATE INDEX "SystemEvent_severity_createdAt_idx" ON "SystemEvent"("severity", "createdAt");
