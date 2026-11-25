ALTER TABLE "WorkshopStockItem"
    ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'OTHER',
    ADD COLUMN "code" TEXT,
    ADD COLUMN "brand" TEXT,
    ADD COLUMN "location" TEXT,
    ADD COLUMN "finish" TEXT,
    ADD COLUMN "minimumStock" DECIMAL(14,3),
    ADD COLUMN "unitsPerPackage" DECIMAL(14,3),
    ADD COLUMN "thicknessMm" DECIMAL(10,3),
    ADD COLUMN "lengthMm" INTEGER,
    ADD COLUMN "widthMm" INTEGER,
    ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
    DROP CONSTRAINT "WorkshopStockItem_unit_check",
    DROP CONSTRAINT "WorkshopStockItem_stockQuantity_check",
    ADD CONSTRAINT "WorkshopStockItem_unit_check" CHECK (
        "unit" IN ('unidade', 'par', 'chapa', 'metro', 'm2')
    ),
    ADD CONSTRAINT "WorkshopStockItem_stockQuantity_check" CHECK (
        "stockQuantity" >= 0 AND "stockQuantity" <> 'NaN'::numeric
        AND ("unit" NOT IN ('unidade', 'par', 'chapa') OR TRUNC("stockQuantity") = "stockQuantity")
    ),
    ADD CONSTRAINT "WorkshopStockItem_profile_check" CHECK (
        "itemType" IN ('HARDWARE', 'MDF_SHEET', 'MDF_OFFCUT', 'OTHER')
        AND ("minimumStock" IS NULL OR ("minimumStock" >= 0 AND "minimumStock" <> 'NaN'::numeric))
        AND ("unitsPerPackage" IS NULL OR ("unitsPerPackage" > 0 AND "unitsPerPackage" <> 'NaN'::numeric))
        AND ("thicknessMm" IS NULL OR ("thicknessMm" > 0 AND "thicknessMm" <> 'NaN'::numeric))
        AND ("lengthMm" IS NULL OR "lengthMm" > 0)
        AND ("widthMm" IS NULL OR "widthMm" > 0)
        AND ("itemType" <> 'MDF_OFFCUT' OR (
            "unit" = 'unidade' AND "thicknessMm" IS NOT NULL
            AND "lengthMm" IS NOT NULL AND "widthMm" IS NOT NULL
        ))
    );

CREATE UNIQUE INDEX "WorkshopStockItem_code_key" ON "WorkshopStockItem"("code");

CREATE TABLE "WorkshopStockOperation" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkshopStockOperation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkshopStockReceipt"
    ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PURCHASE',
    ADD COLUMN "balanceAfter" DECIMAL(14,3),
    ADD COLUMN "reason" TEXT,
    ADD COLUMN "reference" TEXT,
    ADD COLUMN "supplier" TEXT,
    ADD COLUMN "reversalOfId" UUID,
    ADD COLUMN "operationId" UUID,
    DROP CONSTRAINT "WorkshopStockReceipt_quantity_check",
    ADD CONSTRAINT "WorkshopStockReceipt_quantity_check" CHECK (
        "quantity" <> 'NaN'::numeric
        AND (
            ("kind" IN ('PURCHASE', 'RETURN') AND "quantity" > 0)
            OR ("kind" IN ('WITHDRAWAL', 'LOSS') AND "quantity" < 0)
            OR "kind" IN ('COUNT', 'REVERSAL')
        )
        AND (("kind" = 'REVERSAL') = ("reversalOfId" IS NOT NULL))
        AND ("balanceAfter" IS NULL OR ("balanceAfter" >= 0 AND "balanceAfter" <> 'NaN'::numeric))
    ),
    ADD CONSTRAINT "WorkshopStockReceipt_operationId_fkey" FOREIGN KEY ("operationId")
        REFERENCES "WorkshopStockOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WorkshopStockReceipt_operationId_idx" ON "WorkshopStockReceipt"("operationId");
-- The reversal references an immutable receipt, with a unique link to prevent duplicate reversals.
-- Keep it independent of restore order so existing backup tooling can restore receipts by ID.
CREATE UNIQUE INDEX "WorkshopStockReceipt_reversalOfId_key" ON "WorkshopStockReceipt"("reversalOfId");

-- Historic purchases already change the item's current balance. Copy only balances
-- that can be reconstructed from those purchases and keep the original data intact.
WITH "history" AS (
    SELECT "id", "itemId",
        SUM("quantity") OVER (
            PARTITION BY "itemId" ORDER BY "createdAt", "id" ROWS UNBOUNDED PRECEDING
        ) AS "runningBalance",
        SUM("quantity") OVER (PARTITION BY "itemId") AS "total"
    FROM "WorkshopStockReceipt"
)
UPDATE "WorkshopStockReceipt" AS "receipt"
SET "balanceAfter" = "history"."runningBalance"
FROM "history"
JOIN "WorkshopStockItem" AS "item" ON "item"."id" = "history"."itemId"
WHERE "receipt"."id" = "history"."id" AND "item"."stockQuantity" = "history"."total";
