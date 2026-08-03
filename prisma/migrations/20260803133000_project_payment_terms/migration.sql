ALTER TABLE "Project"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'TO_DEFINE',
  ADD COLUMN "paymentDiscount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "cardFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "cardFeeAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0;

UPDATE "Project" AS project
SET
  "paymentMethod" = quote."paymentMethod",
  "paymentDiscount" = quote."paymentDiscount",
  "cardFeePercent" = quote."cardFeePercent",
  "cardFeeAmount" = quote."cardFeeAmount"
FROM "Quote" AS quote
WHERE quote."convertedProjectId" = project."id";

UPDATE "Project"
SET "paymentMethod" = CASE
  WHEN "installmentCount" > 0 THEN 'CARD'
  WHEN COALESCE("value", 0) > 0 AND COALESCE("downPayment", 0) >= COALESCE("value", 0) THEN 'PIX'
  ELSE 'TO_DEFINE'
END
WHERE "paymentMethod" = 'TO_DEFINE'
  AND NOT EXISTS (
    SELECT 1
    FROM "Quote"
    WHERE "Quote"."convertedProjectId" = "Project"."id"
  );

CREATE INDEX "Project_paymentMethod_idx" ON "Project"("paymentMethod");
