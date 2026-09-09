ALTER TABLE "Project" ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "technicalApprovedAt" TIMESTAMP(3),
ADD COLUMN "technicalApprovalSnapshot" TEXT,
ADD COLUMN "technicalApprovalCustomer" TEXT,
ADD COLUMN "technicalApprovalEvidence" TEXT,
ADD COLUMN "technicalApprovalRecordedBy" TEXT;
-- Existing projects retain their workflow. New projects use independent technical approval.
ALTER TABLE "Project" ALTER COLUMN "workflowVersion" SET DEFAULT 2;
ALTER TABLE "Project" ADD COLUMN "initialPaymentRequired" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "QuoteRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "assignedToId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL, "briefing" TEXT NOT NULL, "environments" TEXT NOT NULL,
  "commercialOwner" TEXT NOT NULL, "opportunityUrl" TEXT, "externalOpportunityId" TEXT,
  "referenceUrl" TEXT, "desiredDeliveryDate" TIMESTAMP(3), "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED', "missingInformation" TEXT, "nextAction" TEXT,
  "receivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "QuoteRequest_externalOpportunityId_key" ON "QuoteRequest"("externalOpportunityId");
CREATE INDEX "QuoteRequest_assignedToId_status_dueDate_idx" ON "QuoteRequest"("assignedToId", "status", "dueDate");
CREATE INDEX "QuoteRequest_clientId_idx" ON "QuoteRequest"("clientId");
ALTER TABLE "QuoteGroup" ADD COLUMN "requestId" TEXT REFERENCES "QuoteRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "QuoteGroup_requestId_key" ON "QuoteGroup"("requestId");
