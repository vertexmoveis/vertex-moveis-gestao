ALTER TABLE "Project" ADD COLUMN "approvalDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "deliveryBusinessDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Project" ADD COLUMN "deliveryDeadlineDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "productionReminderBusinessDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Project" ADD COLUMN "productionStartReminderDate" DATETIME;
