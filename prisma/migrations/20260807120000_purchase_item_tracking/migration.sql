ALTER TABLE "PurchaseOrderItem" ADD COLUMN "projectMaterialId" TEXT;

UPDATE "PurchaseOrderItem" item
SET "projectMaterialId" = (
  SELECT material."id"
  FROM "ProjectMaterial" material
  WHERE material."projectId" = item."projectId"
    AND material."materialId" = item."materialId"
  ORDER BY material."createdAt" ASC
  LIMIT 1
)
WHERE item."projectId" IS NOT NULL;

CREATE INDEX "PurchaseOrderItem_projectMaterialId_idx" ON "PurchaseOrderItem"("projectMaterialId");

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_projectMaterialId_fkey"
FOREIGN KEY ("projectMaterialId") REFERENCES "ProjectMaterial"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
