ALTER TABLE "Project" ADD COLUMN "productionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "CompanyProfile" ADD COLUMN "standardSheetWidthMm" INTEGER NOT NULL DEFAULT 2750;
ALTER TABLE "CompanyProfile" ADD COLUMN "standardSheetHeightMm" INTEGER NOT NULL DEFAULT 1850;
ALTER TABLE "CompanyProfile" ADD COLUMN "sheetWastePercent" DOUBLE PRECISION NOT NULL DEFAULT 15;

CREATE TABLE "ProjectCutPiece" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  "environment" TEXT,
  "label" TEXT NOT NULL,
  "material" TEXT NOT NULL,
  "finish" TEXT,
  "widthMm" DOUBLE PRECISION NOT NULL,
  "heightMm" DOUBLE PRECISION NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "grain" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectCutPiece_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTimeEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "minutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectQualityCheck" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "checkedById" TEXT,
  "checkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectQualityCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectChangeOrder" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amountDelta" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "daysDelta" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectChangeOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDeliveryProof" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "installationScheduleId" TEXT,
  "createdById" TEXT,
  "confirmedBy" TEXT NOT NULL,
  "checklist" JSONB NOT NULL,
  "notes" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDeliveryProof_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryReservation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "supplier" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "expectedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "projectId" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesCommission" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "createdById" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectCutPiece_projectId_status_idx" ON "ProjectCutPiece"("projectId", "status");
CREATE INDEX "ProjectCutPiece_material_finish_idx" ON "ProjectCutPiece"("material", "finish");
CREATE INDEX "ProjectTimeEntry_projectId_startedAt_idx" ON "ProjectTimeEntry"("projectId", "startedAt");
CREATE INDEX "ProjectTimeEntry_userId_endedAt_idx" ON "ProjectTimeEntry"("userId", "endedAt");
CREATE INDEX "ProjectTimeEntry_phase_startedAt_idx" ON "ProjectTimeEntry"("phase", "startedAt");
CREATE UNIQUE INDEX "ProjectQualityCheck_projectId_key_key" ON "ProjectQualityCheck"("projectId", "key");
CREATE INDEX "ProjectQualityCheck_projectId_status_idx" ON "ProjectQualityCheck"("projectId", "status");
CREATE INDEX "ProjectChangeOrder_projectId_status_idx" ON "ProjectChangeOrder"("projectId", "status");
CREATE UNIQUE INDEX "ProjectDeliveryProof_installationScheduleId_key" ON "ProjectDeliveryProof"("installationScheduleId");
CREATE INDEX "ProjectDeliveryProof_projectId_deliveredAt_idx" ON "ProjectDeliveryProof"("projectId", "deliveredAt");
CREATE UNIQUE INDEX "InventoryReservation_projectId_materialId_key" ON "InventoryReservation"("projectId", "materialId");
CREATE INDEX "InventoryReservation_materialId_status_idx" ON "InventoryReservation"("materialId", "status");
CREATE INDEX "InventoryReservation_projectId_status_idx" ON "InventoryReservation"("projectId", "status");
CREATE INDEX "PurchaseOrder_status_expectedAt_idx" ON "PurchaseOrder"("status", "expectedAt");
CREATE INDEX "PurchaseOrder_supplier_createdAt_idx" ON "PurchaseOrder"("supplier", "createdAt");
CREATE INDEX "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId");
CREATE INDEX "PurchaseOrderItem_materialId_idx" ON "PurchaseOrderItem"("materialId");
CREATE INDEX "PurchaseOrderItem_projectId_idx" ON "PurchaseOrderItem"("projectId");
CREATE UNIQUE INDEX "SalesCommission_projectId_userId_key" ON "SalesCommission"("projectId", "userId");
CREATE INDEX "SalesCommission_userId_status_idx" ON "SalesCommission"("userId", "status");
CREATE INDEX "SalesCommission_status_availableAt_idx" ON "SalesCommission"("status", "availableAt");
CREATE INDEX "PrivacyRequest_clientId_status_idx" ON "PrivacyRequest"("clientId", "status");
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status", "createdAt");

ALTER TABLE "ProjectCutPiece" ADD CONSTRAINT "ProjectCutPiece_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCutPiece" ADD CONSTRAINT "ProjectCutPiece_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectTimeEntry" ADD CONSTRAINT "ProjectTimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectTimeEntry" ADD CONSTRAINT "ProjectTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectQualityCheck" ADD CONSTRAINT "ProjectQualityCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectQualityCheck" ADD CONSTRAINT "ProjectQualityCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeOrder" ADD CONSTRAINT "ProjectChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeOrder" ADD CONSTRAINT "ProjectChangeOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliveryProof" ADD CONSTRAINT "ProjectDeliveryProof_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliveryProof" ADD CONSTRAINT "ProjectDeliveryProof_installationScheduleId_fkey" FOREIGN KEY ("installationScheduleId") REFERENCES "InstallationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliveryProof" ADD CONSTRAINT "ProjectDeliveryProof_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
