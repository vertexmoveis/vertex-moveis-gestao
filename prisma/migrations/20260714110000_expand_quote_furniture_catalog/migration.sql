ALTER TABLE "QuoteItem" ADD COLUMN "furnitureType" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN "furnitureModel" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN "calculationMode" TEXT NOT NULL DEFAULT 'AREA_M2';
ALTER TABLE "QuoteItem" ADD COLUMN "manualPrice" REAL;
ALTER TABLE "QuoteItem" ADD COLUMN "accessories" TEXT;
