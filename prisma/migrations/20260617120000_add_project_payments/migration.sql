-- AlterTable
ALTER TABLE "Project" ADD COLUMN "downPayment" REAL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "installmentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "installmentValue" REAL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProjectPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectPayment_projectId_idx" ON "ProjectPayment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPayment_dueDate_idx" ON "ProjectPayment"("dueDate");

-- CreateIndex
CREATE INDEX "ProjectPayment_paidAt_idx" ON "ProjectPayment"("paidAt");
