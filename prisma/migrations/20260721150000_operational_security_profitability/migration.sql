ALTER TABLE "User"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

ALTER TABLE "Project"
  ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3);

ALTER TABLE "QuoteApprovalRequest"
  ADD COLUMN "responseName" TEXT,
  ADD COLUMN "responseDocument" TEXT,
  ADD COLUMN "acceptedTermsAt" TIMESTAMP(3);

CREATE TABLE "ProjectExpense" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "incurredAt" TIMESTAMP(3) NOT NULL,
  "supplier" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_paymentConfirmedAt_idx" ON "Project"("paymentConfirmedAt");
CREATE INDEX "ProjectExpense_projectId_idx" ON "ProjectExpense"("projectId");
CREATE INDEX "ProjectExpense_category_idx" ON "ProjectExpense"("category");
CREATE INDEX "ProjectExpense_incurredAt_idx" ON "ProjectExpense"("incurredAt");
CREATE INDEX "ProjectExpense_createdById_idx" ON "ProjectExpense"("createdById");

ALTER TABLE "ProjectExpense"
  ADD CONSTRAINT "ProjectExpense_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectExpense"
  ADD CONSTRAINT "ProjectExpense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
