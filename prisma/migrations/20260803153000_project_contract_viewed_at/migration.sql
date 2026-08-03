ALTER TABLE "ProjectContract"
  ADD COLUMN "viewedAt" TIMESTAMP(3);

CREATE INDEX "ProjectContract_viewedAt_idx" ON "ProjectContract"("viewedAt");

ALTER TABLE "Project"
  ADD COLUMN "contractRevisionRequiredAt" TIMESTAMP(3);

CREATE INDEX "Project_contractRevisionRequiredAt_idx" ON "Project"("contractRevisionRequiredAt");
