-- AlterTable
ALTER TABLE "Project" ADD COLUMN "postSaleContactedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "postSaleFollowUpAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "warrantyEndsAt" DATETIME;

-- CreateTable
CREATE TABLE "QuotePriceRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "environment" TEXT,
    "furnitureType" TEXT,
    "furnitureModel" TEXT,
    "priceProfile" TEXT,
    "calculationMode" TEXT NOT NULL DEFAULT 'AREA_M2',
    "pricePerM2" REAL NOT NULL,
    "materialCostPerM2" REAL,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaterialCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultFinish" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'm2',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "materialId" TEXT,
    "materialName" TEXT NOT NULL,
    "finish" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'm2',
    "estimatedQuantity" REAL NOT NULL DEFAULT 0,
    "purchasedQuantity" REAL NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "actualCost" REAL,
    "supplier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMaterial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialCatalogItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationalResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstallationSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scheduledStart" DATETIME NOT NULL,
    "scheduledEnd" DATETIME NOT NULL,
    "teamId" TEXT,
    "vehicleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstallationSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallationSchedule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OperationalResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallationSchedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "OperationalResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" DATETIME,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "expiresAt" DATETIME,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteApprovalRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuotePriceRule_active_validFrom_validUntil_idx" ON "QuotePriceRule"("active", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "QuotePriceRule_environment_furnitureType_furnitureModel_idx" ON "QuotePriceRule"("environment", "furnitureType", "furnitureModel");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCatalogItem_name_key" ON "MaterialCatalogItem"("name");

-- CreateIndex
CREATE INDEX "MaterialCatalogItem_active_idx" ON "MaterialCatalogItem"("active");

-- CreateIndex
CREATE INDEX "MaterialCatalogItem_category_idx" ON "MaterialCatalogItem"("category");

-- CreateIndex
CREATE INDEX "ProjectMaterial_projectId_idx" ON "ProjectMaterial"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMaterial_status_idx" ON "ProjectMaterial"("status");

-- CreateIndex
CREATE INDEX "ProjectMaterial_materialId_idx" ON "ProjectMaterial"("materialId");

-- CreateIndex
CREATE INDEX "OperationalResource_active_type_idx" ON "OperationalResource"("active", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalResource_type_name_key" ON "OperationalResource"("type", "name");

-- CreateIndex
CREATE INDEX "InstallationSchedule_projectId_idx" ON "InstallationSchedule"("projectId");

-- CreateIndex
CREATE INDEX "InstallationSchedule_scheduledStart_scheduledEnd_idx" ON "InstallationSchedule"("scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE INDEX "InstallationSchedule_teamId_scheduledStart_idx" ON "InstallationSchedule"("teamId", "scheduledStart");

-- CreateIndex
CREATE INDEX "InstallationSchedule_vehicleId_scheduledStart_idx" ON "InstallationSchedule"("vehicleId", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteApprovalRequest_token_key" ON "QuoteApprovalRequest"("token");

-- CreateIndex
CREATE INDEX "QuoteApprovalRequest_quoteId_idx" ON "QuoteApprovalRequest"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteApprovalRequest_expiresAt_idx" ON "QuoteApprovalRequest"("expiresAt");
