-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "creditLimit" DECIMAL(14,2),
ADD COLUMN     "creditNotes" TEXT,
ADD COLUMN     "creditReviewedAt" TIMESTAMP(3),
ADD COLUMN     "creditStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "FinanceReceipt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DIRECT',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceiptAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "FinanceReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_requestId_key" ON "FinanceReceipt"("requestId");

-- CreateIndex
CREATE INDEX "FinanceReceipt_projectId_receivedAt_idx" ON "FinanceReceipt"("projectId", "receivedAt");

-- CreateIndex
CREATE INDEX "FinanceReceipt_receivedAt_reversedAt_idx" ON "FinanceReceipt"("receivedAt", "reversedAt");

-- CreateIndex
CREATE INDEX "FinanceReceiptAllocation_paymentId_idx" ON "FinanceReceiptAllocation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceiptAllocation_receiptId_paymentId_key" ON "FinanceReceiptAllocation"("receiptId", "paymentId");

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptAllocation" ADD CONSTRAINT "FinanceReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "FinanceReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptAllocation" ADD CONSTRAINT "FinanceReceiptAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ProjectPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
