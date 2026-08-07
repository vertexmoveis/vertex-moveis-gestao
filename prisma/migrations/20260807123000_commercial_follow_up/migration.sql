ALTER TABLE "Client"
ADD COLUMN "commercialSource" TEXT,
ADD COLUMN "nextCommercialAction" TEXT,
ADD COLUMN "nextCommercialActionAt" TIMESTAMP(3);

CREATE INDEX "Client_nextCommercialActionAt_relationshipStage_idx"
ON "Client"("nextCommercialActionAt", "relationshipStage");
