-- CreateTable
CREATE TABLE "ProjectEnvironment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEnvironment_projectId_position_key" ON "ProjectEnvironment"("projectId", "position");

-- CreateIndex
CREATE INDEX "ProjectEnvironment_projectId_idx" ON "ProjectEnvironment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEnvironment_status_idx" ON "ProjectEnvironment"("status");

-- CreateIndex
CREATE INDEX "ProjectEnvironment_completedAt_idx" ON "ProjectEnvironment"("completedAt");
