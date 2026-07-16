DELETE FROM "ProjectPayment"
WHERE "paidAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ProjectPayment" AS received
    WHERE received."projectId" = "ProjectPayment"."projectId"
      AND received."type" = "ProjectPayment"."type"
      AND received."installmentNumber" = "ProjectPayment"."installmentNumber"
      AND received."paidAt" IS NOT NULL
  );

DELETE FROM "ProjectPayment"
WHERE "paidAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ProjectPayment" AS older
    WHERE older."projectId" = "ProjectPayment"."projectId"
      AND older."type" = "ProjectPayment"."type"
      AND older."installmentNumber" = "ProjectPayment"."installmentNumber"
      AND older."paidAt" IS NULL
      AND older."createdAt" < "ProjectPayment"."createdAt"
  );

UPDATE "ProjectPayment"
SET "paidAt" = "paidAt" + 43200000
WHERE "type" = 'DOWN_PAYMENT'
  AND "paidAt" IS NOT NULL
  AND ("paidAt" % 86400000) = 0;

UPDATE "ProjectPayment"
SET "dueDate" = "dueDate" + 43200000
WHERE ("dueDate" % 86400000) = 0;

CREATE UNIQUE INDEX "ProjectPayment_projectId_type_installmentNumber_key"
ON "ProjectPayment"("projectId", "type", "installmentNumber");
