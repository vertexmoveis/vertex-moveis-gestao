ALTER TABLE "QuoteApprovalRequest"
ADD COLUMN "comparisonQuoteId" TEXT,
ADD COLUMN "selectedQuoteId" TEXT,
ADD COLUMN "comparisonRevisionVersion" INTEGER;

CREATE INDEX "QuoteApprovalRequest_comparisonQuoteId_idx"
ON "QuoteApprovalRequest"("comparisonQuoteId");

CREATE INDEX "QuoteApprovalRequest_selectedQuoteId_idx"
ON "QuoteApprovalRequest"("selectedQuoteId");

ALTER TABLE "QuoteApprovalRequest"
ADD CONSTRAINT "QuoteApprovalRequest_comparisonQuoteId_fkey"
FOREIGN KEY ("comparisonQuoteId") REFERENCES "Quote"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteApprovalRequest"
ADD CONSTRAINT "QuoteApprovalRequest_selectedQuoteId_fkey"
FOREIGN KEY ("selectedQuoteId") REFERENCES "Quote"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
