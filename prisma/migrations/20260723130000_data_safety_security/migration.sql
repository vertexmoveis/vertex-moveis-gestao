-- Improve financial precision without changing existing business values.
ALTER TABLE "Project"
  ALTER COLUMN "value" TYPE DECIMAL(14,2) USING ROUND("value"::numeric, 2),
  ALTER COLUMN "productionCost" TYPE DECIMAL(14,2) USING ROUND("productionCost"::numeric, 2),
  ALTER COLUMN "downPayment" TYPE DECIMAL(14,2) USING ROUND("downPayment"::numeric, 2),
  ALTER COLUMN "installmentValue" TYPE DECIMAL(14,2) USING ROUND("installmentValue"::numeric, 2);

ALTER TABLE "Quote"
  ALTER COLUMN "pricePerM2" TYPE DECIMAL(14,2) USING ROUND("pricePerM2"::numeric, 2),
  ALTER COLUMN "materialCostPerM2" TYPE DECIMAL(14,2) USING ROUND("materialCostPerM2"::numeric, 2),
  ALTER COLUMN "installationFee" TYPE DECIMAL(14,2) USING ROUND("installationFee"::numeric, 2),
  ALTER COLUMN "discount" TYPE DECIMAL(14,2) USING ROUND("discount"::numeric, 2),
  ALTER COLUMN "manualDiscount" TYPE DECIMAL(14,2) USING ROUND("manualDiscount"::numeric, 2),
  ALTER COLUMN "paymentDiscount" TYPE DECIMAL(14,2) USING ROUND("paymentDiscount"::numeric, 2),
  ALTER COLUMN "cardDownPayment" TYPE DECIMAL(14,2) USING ROUND("cardDownPayment"::numeric, 2),
  ALTER COLUMN "cardFeeAmount" TYPE DECIMAL(14,2) USING ROUND("cardFeeAmount"::numeric, 2),
  ALTER COLUMN "subtotal" TYPE DECIMAL(14,2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "costTotal" TYPE DECIMAL(14,2) USING ROUND("costTotal"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(14,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "QuoteItem"
  ALTER COLUMN "manualPrice" TYPE DECIMAL(14,2) USING ROUND("manualPrice"::numeric, 2),
  ALTER COLUMN "unitPrice" TYPE DECIMAL(14,2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "cost" TYPE DECIMAL(14,2) USING ROUND("cost"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(14,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "QuotePriceRule"
  ALTER COLUMN "pricePerM2" TYPE DECIMAL(14,2) USING ROUND("pricePerM2"::numeric, 2),
  ALTER COLUMN "materialCostPerM2" TYPE DECIMAL(14,2) USING ROUND("materialCostPerM2"::numeric, 2);

ALTER TABLE "MaterialCatalogItem"
  ALTER COLUMN "unitCost" TYPE DECIMAL(14,2) USING ROUND("unitCost"::numeric, 2);

ALTER TABLE "ProjectMaterial"
  ALTER COLUMN "estimatedCost" TYPE DECIMAL(14,2) USING ROUND("estimatedCost"::numeric, 2),
  ALTER COLUMN "actualCost" TYPE DECIMAL(14,2) USING ROUND("actualCost"::numeric, 2);

ALTER TABLE "ProjectExpense"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "ProjectPayment"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "PaymentHistory"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);

-- Archive records instead of permanently removing operational history.
ALTER TABLE "Client" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Project"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "productionBlockedAt" TIMESTAMP(3),
  ADD COLUMN "productionBlockReason" TEXT,
  ADD COLUMN "stageDeadlineDate" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Client_archivedAt_idx" ON "Client"("archivedAt");
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");
CREATE INDEX "Project_productionBlockedAt_idx" ON "Project"("productionBlockedAt");
CREATE INDEX "Project_stageDeadlineDate_idx" ON "Project"("stageDeadlineDate");
CREATE INDEX "Quote_archivedAt_idx" ON "Quote"("archivedAt");

-- Optional two-factor authentication and login audit.
ALTER TABLE "User"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorSecret" TEXT;

CREATE TABLE "LoginEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");
CREATE INDEX "LoginEvent_email_createdAt_idx" ON "LoginEvent"("email", "createdAt");
CREATE INDEX "LoginEvent_success_createdAt_idx" ON "LoginEvent"("success", "createdAt");
ALTER TABLE "LoginEvent"
  ADD CONSTRAINT "LoginEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Public, revocable project tracking links.
CREATE TABLE "ProjectPortalAccess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastViewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectPortalAccess_tokenHash_key" ON "ProjectPortalAccess"("tokenHash");
CREATE INDEX "ProjectPortalAccess_projectId_idx" ON "ProjectPortalAccess"("projectId");
CREATE INDEX "ProjectPortalAccess_expiresAt_idx" ON "ProjectPortalAccess"("expiresAt");
CREATE INDEX "ProjectPortalAccess_revokedAt_idx" ON "ProjectPortalAccess"("revokedAt");
ALTER TABLE "ProjectPortalAccess"
  ADD CONSTRAINT "ProjectPortalAccess_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
