ALTER TABLE "ProjectFile"
  ADD COLUMN "securityStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "securityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "securityDetails" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "ProjectFile"
SET
  "securityStatus" = 'TYPE_CHECKED',
  "securityCheckedAt" = CURRENT_TIMESTAMP
WHERE "securityStatus" = 'PENDING';

CREATE INDEX "ProjectFile_securityStatus_idx" ON "ProjectFile"("securityStatus");
CREATE INDEX "ProjectFile_expiresAt_idx" ON "ProjectFile"("expiresAt");

CREATE TABLE "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "clientName" TEXT,
  "quoteId" TEXT,
  "projectId" TEXT,
  "paymentId" TEXT,
  "templateName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppMessage_dedupeKey_key" ON "WhatsAppMessage"("dedupeKey");
CREATE INDEX "WhatsAppMessage_status_createdAt_idx" ON "WhatsAppMessage"("status", "createdAt");
CREATE INDEX "WhatsAppMessage_providerMessageId_idx" ON "WhatsAppMessage"("providerMessageId");
CREATE INDEX "WhatsAppMessage_quoteId_idx" ON "WhatsAppMessage"("quoteId");
CREATE INDEX "WhatsAppMessage_projectId_idx" ON "WhatsAppMessage"("projectId");
