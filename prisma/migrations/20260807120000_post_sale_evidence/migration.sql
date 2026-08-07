ALTER TABLE "Project"
ADD COLUMN "satisfactionRating" INTEGER,
ADD COLUMN "satisfactionComment" TEXT,
ADD COLUMN "satisfactionRespondedAt" TIMESTAMP(3);

ALTER TABLE "ProjectChangeOrder"
ADD COLUMN "clientRespondedAt" TIMESTAMP(3),
ADD COLUMN "clientRespondentName" TEXT,
ADD COLUMN "clientResponseNote" TEXT,
ADD COLUMN "clientResponseIpHash" TEXT;

ALTER TABLE "ProjectFile"
ADD COLUMN "warrantyTicketId" TEXT;

CREATE INDEX "ProjectFile_warrantyTicketId_idx" ON "ProjectFile"("warrantyTicketId");

ALTER TABLE "ProjectFile"
ADD CONSTRAINT "ProjectFile_warrantyTicketId_fkey"
FOREIGN KEY ("warrantyTicketId") REFERENCES "WarrantyTicket"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_satisfactionRating_check"
CHECK ("satisfactionRating" IS NULL OR "satisfactionRating" BETWEEN 1 AND 5);
