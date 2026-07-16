-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "street" TEXT,
    "number" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geocodedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "stage" TEXT NOT NULL DEFAULT 'PENDING_START',
    "approvalDate" TIMESTAMP(3),
    "deliveryBusinessDays" INTEGER NOT NULL DEFAULT 30,
    "deliveryDeadlineDate" TIMESTAMP(3),
    "productionReminderBusinessDays" INTEGER NOT NULL DEFAULT 7,
    "productionStartReminderDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "value" DOUBLE PRECISION,
    "productionCost" DOUBLE PRECISION DEFAULT 0,
    "downPayment" DOUBLE PRECISION DEFAULT 0,
    "downPaymentDate" TIMESTAMP(3),
    "installmentCount" INTEGER NOT NULL DEFAULT 0,
    "installmentValue" DOUBLE PRECISION DEFAULT 0,
    "firstInstallmentDate" TIMESTAMP(3),
    "managerId" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postSaleFollowUpAt" TIMESTAMP(3),
    "postSaleContactedAt" TIMESTAMP(3),
    "warrantyEndsAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT,
    "convertedProjectId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "pricePerM2" DOUBLE PRECISION NOT NULL DEFAULT 1250,
    "materialCostPerM2" DOUBLE PRECISION NOT NULL DEFAULT 650,
    "installationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'TO_DEFINE',
    "cardInstallments" INTEGER NOT NULL DEFAULT 1,
    "cardDownPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "customerNotes" TEXT,
    "lossReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "furnitureType" TEXT,
    "furnitureModel" TEXT,
    "material" TEXT,
    "finish" TEXT,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION,
    "difficulty" TEXT NOT NULL DEFAULT 'NORMAL',
    "calculationMode" TEXT NOT NULL DEFAULT 'AREA_M2',
    "priceProfile" TEXT NOT NULL DEFAULT 'STANDARD',
    "manualPrice" DOUBLE PRECISION,
    "accessories" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRevision" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePriceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" TEXT,
    "furnitureType" TEXT,
    "furnitureModel" TEXT,
    "priceProfile" TEXT,
    "calculationMode" TEXT NOT NULL DEFAULT 'AREA_M2',
    "pricePerM2" DOUBLE PRECISION NOT NULL,
    "materialCostPerM2" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotePriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultFinish" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'm2',
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterial" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "materialId" TEXT,
    "materialName" TEXT NOT NULL,
    "finish" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'm2',
    "estimatedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCost" DOUBLE PRECISION,
    "supplier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT,
    "vehicleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteApprovalRequest" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEnvironment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPayment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHistory" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChecklistItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_city_idx" ON "Client"("city");

-- CreateIndex
CREATE INDEX "Client_zipCode_idx" ON "Client"("zipCode");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_stage_idx" ON "Project"("stage");

-- CreateIndex
CREATE INDEX "Project_managerId_idx" ON "Project"("managerId");

-- CreateIndex
CREATE INDEX "Project_estimatedEndDate_idx" ON "Project"("estimatedEndDate");

-- CreateIndex
CREATE INDEX "Project_approvalDate_idx" ON "Project"("approvalDate");

-- CreateIndex
CREATE INDEX "Project_deliveryDeadlineDate_idx" ON "Project"("deliveryDeadlineDate");

-- CreateIndex
CREATE INDEX "Project_productionStartReminderDate_idx" ON "Project"("productionStartReminderDate");

-- CreateIndex
CREATE INDEX "Project_stage_postSaleFollowUpAt_idx" ON "Project"("stage", "postSaleFollowUpAt");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_convertedProjectId_key" ON "Quote"("convertedProjectId");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE INDEX "Quote_createdById_idx" ON "Quote"("createdById");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_validUntil_idx" ON "Quote"("validUntil");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_environment_idx" ON "QuoteItem"("environment");

-- CreateIndex
CREATE INDEX "QuoteRevision_quoteId_idx" ON "QuoteRevision"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRevision_quoteId_version_key" ON "QuoteRevision"("quoteId", "version");

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

-- CreateIndex
CREATE INDEX "QuoteApprovalRequest_sentAt_idx" ON "QuoteApprovalRequest"("sentAt");

-- CreateIndex
CREATE INDEX "ProjectEnvironment_projectId_idx" ON "ProjectEnvironment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEnvironment_status_idx" ON "ProjectEnvironment"("status");

-- CreateIndex
CREATE INDEX "ProjectEnvironment_completedAt_idx" ON "ProjectEnvironment"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEnvironment_projectId_position_key" ON "ProjectEnvironment"("projectId", "position");

-- CreateIndex
CREATE INDEX "ProjectPayment_projectId_idx" ON "ProjectPayment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPayment_dueDate_idx" ON "ProjectPayment"("dueDate");

-- CreateIndex
CREATE INDEX "ProjectPayment_paidAt_idx" ON "ProjectPayment"("paidAt");

-- CreateIndex
CREATE INDEX "ProjectPayment_paymentMethod_idx" ON "ProjectPayment"("paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPayment_projectId_type_installmentNumber_key" ON "ProjectPayment"("projectId", "type", "installmentNumber");

-- CreateIndex
CREATE INDEX "PaymentHistory_paymentId_idx" ON "PaymentHistory"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentHistory_userId_idx" ON "PaymentHistory"("userId");

-- CreateIndex
CREATE INDEX "PaymentHistory_createdAt_idx" ON "PaymentHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectChecklistItem_projectId_idx" ON "ProjectChecklistItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChecklistItem_completedAt_idx" ON "ProjectChecklistItem"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectChecklistItem_projectId_position_key" ON "ProjectChecklistItem"("projectId", "position");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_convertedProjectId_fkey" FOREIGN KEY ("convertedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRevision" ADD CONSTRAINT "QuoteRevision_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterial" ADD CONSTRAINT "ProjectMaterial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterial" ADD CONSTRAINT "ProjectMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationSchedule" ADD CONSTRAINT "InstallationSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationSchedule" ADD CONSTRAINT "InstallationSchedule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OperationalResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationSchedule" ADD CONSTRAINT "InstallationSchedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "OperationalResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteApprovalRequest" ADD CONSTRAINT "QuoteApprovalRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEnvironment" ADD CONSTRAINT "ProjectEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPayment" ADD CONSTRAINT "ProjectPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ProjectPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChecklistItem" ADD CONSTRAINT "ProjectChecklistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
