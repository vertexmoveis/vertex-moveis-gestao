-- CreateIndex
CREATE INDEX "Project_stage_postSaleFollowUpAt_idx" ON "Project"("stage", "postSaleFollowUpAt");

-- CreateIndex
CREATE INDEX "QuoteApprovalRequest_sentAt_idx" ON "QuoteApprovalRequest"("sentAt");
