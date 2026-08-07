ALTER TABLE "WarrantyTicket" ADD COLUMN "dueAt" TIMESTAMP(3);

UPDATE "WarrantyTicket"
SET "dueAt" = "openedAt" + CASE
  WHEN "priority" = 'URGENT' THEN INTERVAL '1 day'
  WHEN "priority" = 'HIGH' THEN INTERVAL '2 days'
  ELSE INTERVAL '5 days'
END
WHERE "dueAt" IS NULL AND "status" NOT IN ('RESOLVED', 'CANCELED');

CREATE INDEX "WarrantyTicket_status_dueAt_idx" ON "WarrantyTicket"("status", "dueAt");
