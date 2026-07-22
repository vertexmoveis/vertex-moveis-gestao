ALTER TABLE "QuoteItem" ADD COLUMN "environmentName" TEXT;

UPDATE "QuoteItem"
SET "environmentName" = "environment"
WHERE "environmentName" IS NULL;
