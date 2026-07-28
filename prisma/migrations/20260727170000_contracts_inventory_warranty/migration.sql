ALTER TABLE "MaterialCatalogItem"
  ADD COLUMN "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "minimumStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "location" TEXT;

CREATE INDEX "MaterialCatalogItem_active_stockQuantity_idx"
  ON "MaterialCatalogItem"("active", "stockQuantity");

CREATE TABLE "MaterialSupplierPrice" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "supplier" TEXT NOT NULL,
  "unitCost" DECIMAL(14,2) NOT NULL,
  "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialSupplierPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaterialSupplierPrice_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "MaterialCatalogItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MaterialSupplierPrice_materialId_quotedAt_idx"
  ON "MaterialSupplierPrice"("materialId", "quotedAt");
CREATE INDEX "MaterialSupplierPrice_supplier_idx"
  ON "MaterialSupplierPrice"("supplier");

CREATE TABLE "ProjectContract" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "tokenHash" TEXT NOT NULL,
  "tokenEncrypted" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "signatoryName" TEXT,
  "signatoryDocument" TEXT,
  "acceptedIpHash" TEXT,
  "acceptedUserAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContract_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectContract_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectContract_tokenHash_key" ON "ProjectContract"("tokenHash");
CREATE UNIQUE INDEX "ProjectContract_projectId_version_key" ON "ProjectContract"("projectId", "version");
CREATE INDEX "ProjectContract_projectId_status_idx" ON "ProjectContract"("projectId", "status");
CREATE INDEX "ProjectContract_expiresAt_idx" ON "ProjectContract"("expiresAt");

CREATE TABLE "WarrantyTicket" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  "assignedToId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarrantyTicket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WarrantyTicket_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WarrantyTicket_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WarrantyTicket_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WarrantyTicket_projectId_status_idx" ON "WarrantyTicket"("projectId", "status");
CREATE INDEX "WarrantyTicket_status_priority_openedAt_idx" ON "WarrantyTicket"("status", "priority", "openedAt");
CREATE INDEX "WarrantyTicket_assignedToId_status_idx" ON "WarrantyTicket"("assignedToId", "status");
CREATE INDEX "WarrantyTicket_scheduledAt_idx" ON "WarrantyTicket"("scheduledAt");
