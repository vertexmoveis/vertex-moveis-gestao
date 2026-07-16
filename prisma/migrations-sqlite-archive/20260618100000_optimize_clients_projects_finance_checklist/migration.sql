ALTER TABLE "Client" ADD COLUMN "latitude" REAL;
ALTER TABLE "Client" ADD COLUMN "longitude" REAL;
ALTER TABLE "Client" ADD COLUMN "geocodedAt" DATETIME;

ALTER TABLE "Project" ADD COLUMN "productionCost" REAL DEFAULT 0;

ALTER TABLE "ProjectPayment" ADD COLUMN "paymentMethod" TEXT;

CREATE TABLE "PaymentHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "method" TEXT,
  "amount" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ProjectPayment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ProjectChecklistItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProjectChecklistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Client_name_idx" ON "Client"("name");
CREATE INDEX "Client_city_idx" ON "Client"("city");
CREATE INDEX "Client_zipCode_idx" ON "Client"("zipCode");

CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_stage_idx" ON "Project"("stage");
CREATE INDEX "Project_managerId_idx" ON "Project"("managerId");
CREATE INDEX "Project_estimatedEndDate_idx" ON "Project"("estimatedEndDate");
CREATE INDEX "Project_approvalDate_idx" ON "Project"("approvalDate");
CREATE INDEX "Project_deliveryDeadlineDate_idx" ON "Project"("deliveryDeadlineDate");
CREATE INDEX "Project_productionStartReminderDate_idx" ON "Project"("productionStartReminderDate");
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

CREATE INDEX "ProjectPayment_paymentMethod_idx" ON "ProjectPayment"("paymentMethod");
CREATE INDEX "PaymentHistory_paymentId_idx" ON "PaymentHistory"("paymentId");
CREATE INDEX "PaymentHistory_userId_idx" ON "PaymentHistory"("userId");
CREATE INDEX "PaymentHistory_createdAt_idx" ON "PaymentHistory"("createdAt");
CREATE UNIQUE INDEX "ProjectChecklistItem_projectId_position_key" ON "ProjectChecklistItem"("projectId", "position");
CREATE INDEX "ProjectChecklistItem_projectId_idx" ON "ProjectChecklistItem"("projectId");
CREATE INDEX "ProjectChecklistItem_completedAt_idx" ON "ProjectChecklistItem"("completedAt");
