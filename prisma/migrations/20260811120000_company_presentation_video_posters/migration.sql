ALTER TABLE "CompanyPresentationImage"
ADD COLUMN "posterUrl" TEXT,
ADD COLUMN "posterType" TEXT,
ADD COLUMN "posterSize" INTEGER;

CREATE UNIQUE INDEX "CompanyPresentationImage_posterUrl_key"
ON "CompanyPresentationImage"("posterUrl");
