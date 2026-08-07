CREATE TABLE "UserAlertState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAlertState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAlertState_userId_alertId_key" ON "UserAlertState"("userId", "alertId");
CREATE INDEX "UserAlertState_userId_snoozedUntil_idx" ON "UserAlertState"("userId", "snoozedUntil");

ALTER TABLE "UserAlertState"
ADD CONSTRAINT "UserAlertState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
