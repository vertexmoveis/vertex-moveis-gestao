CREATE TABLE "WorkshopStockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "stockQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStockItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkshopStockItem_unit_check" CHECK ("unit" IN ('unidade', 'chapa', 'metro', 'm2')),
    CONSTRAINT "WorkshopStockItem_stockQuantity_check" CHECK (
        "stockQuantity" >= 0 AND "stockQuantity" <> 'NaN'::numeric
        AND ("unit" NOT IN ('unidade', 'chapa') OR TRUNC("stockQuantity") = "stockQuantity")
    )
);

CREATE TABLE "WorkshopStockReceipt" (
    "id" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopStockReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkshopStockReceipt_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 1000000)
);

CREATE UNIQUE INDEX "WorkshopStockItem_name_unit_key" ON "WorkshopStockItem"("name", "unit");

CREATE INDEX "WorkshopStockReceipt_itemId_createdAt_idx" ON "WorkshopStockReceipt"("itemId", "createdAt");

ALTER TABLE "WorkshopStockReceipt" ADD CONSTRAINT "WorkshopStockReceipt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WorkshopStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkshopStockReceipt" ADD CONSTRAINT "WorkshopStockReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
