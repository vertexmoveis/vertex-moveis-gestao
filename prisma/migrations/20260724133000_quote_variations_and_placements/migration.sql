CREATE TABLE "QuoteGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Quote"
    ADD COLUMN "groupId" TEXT,
    ADD COLUMN "variationType" TEXT NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN "variationName" TEXT NOT NULL DEFAULT 'Padrão',
    ADD COLUMN "variationOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "QuoteItem"
    ADD COLUMN "placement" TEXT,
    ADD COLUMN "sourceItemKey" TEXT;

CREATE TABLE "QuoteApprovalOption" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "revisionVersion" INTEGER,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteApprovalOption_pkey" PRIMARY KEY ("id")
);

INSERT INTO "QuoteGroup" ("id", "clientId", "createdById", "title", "createdAt", "updatedAt")
SELECT
    'legacy-group-' || q."id",
    q."clientId",
    q."createdById",
    q."title",
    q."createdAt",
    q."updatedAt"
FROM "Quote" q;

UPDATE "Quote" q
SET
    "groupId" = 'legacy-group-' || q."id",
    "variationType" = COALESCE((
        SELECT CASE
            WHEN COUNT(DISTINCT qi."priceProfile") = 1 THEN MAX(qi."priceProfile")
            ELSE 'CUSTOM'
        END
        FROM "QuoteItem" qi
        WHERE qi."quoteId" = q."id"
    ), 'STANDARD'),
    "variationName" = COALESCE((
        SELECT CASE
            WHEN COUNT(DISTINCT qi."priceProfile") <> 1 THEN 'Personalizada'
            WHEN MAX(qi."priceProfile") = 'WOODGRAIN' THEN 'Madeirado'
            WHEN MAX(qi."priceProfile") = 'PROVENCAL' THEN 'Provençal'
            WHEN MAX(qi."priceProfile") = 'EXTERNAL_LACQUER' THEN 'Laca'
            ELSE 'Padrão'
        END
        FROM "QuoteItem" qi
        WHERE qi."quoteId" = q."id"
    ), 'Padrão');

UPDATE "QuoteItem"
SET "sourceItemKey" = 'legacy-item-' || "id";

WITH linked_pairs AS (
    SELECT DISTINCT ON (LEAST(r."quoteId", r."comparisonQuoteId"), GREATEST(r."quoteId", r."comparisonQuoteId"))
        r."quoteId" AS primary_id,
        r."comparisonQuoteId" AS comparison_id
    FROM "QuoteApprovalRequest" r
    WHERE r."comparisonQuoteId" IS NOT NULL
    ORDER BY
        LEAST(r."quoteId", r."comparisonQuoteId"),
        GREATEST(r."quoteId", r."comparisonQuoteId"),
        r."createdAt" DESC
)
UPDATE "Quote" comparison
SET
    "groupId" = primary_quote."groupId",
    "variationOrder" = 1
FROM linked_pairs pair
JOIN "Quote" primary_quote ON primary_quote."id" = pair.primary_id
WHERE comparison."id" = pair.comparison_id;

WITH ranked_quotes AS (
    SELECT
        q."id",
        (ROW_NUMBER() OVER (
            PARTITION BY q."groupId"
            ORDER BY q."variationOrder", q."createdAt", q."id"
        ) - 1)::INTEGER AS position
    FROM "Quote" q
)
UPDATE "Quote" q
SET "variationOrder" = ranked_quotes.position
FROM ranked_quotes
WHERE ranked_quotes."id" = q."id";

DELETE FROM "QuoteGroup" group_record
WHERE NOT EXISTS (
    SELECT 1
    FROM "Quote" q
    WHERE q."groupId" = group_record."id"
);

INSERT INTO "QuoteApprovalOption" ("id", "requestId", "quoteId", "revisionVersion", "position", "createdAt")
SELECT
    'legacy-approval-option-' || r."id" || '-0',
    r."id",
    r."quoteId",
    r."revisionVersion",
    0,
    r."createdAt"
FROM "QuoteApprovalRequest" r;

INSERT INTO "QuoteApprovalOption" ("id", "requestId", "quoteId", "revisionVersion", "position", "createdAt")
SELECT
    'legacy-approval-option-' || r."id" || '-1',
    r."id",
    r."comparisonQuoteId",
    r."comparisonRevisionVersion",
    1,
    r."createdAt"
FROM "QuoteApprovalRequest" r
WHERE r."comparisonQuoteId" IS NOT NULL
  AND r."comparisonQuoteId" <> r."quoteId";

ALTER TABLE "Quote" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "QuoteItem" ALTER COLUMN "sourceItemKey" SET NOT NULL;

CREATE UNIQUE INDEX "Quote_groupId_variationOrder_key" ON "Quote"("groupId", "variationOrder");
CREATE INDEX "Quote_groupId_idx" ON "Quote"("groupId");
CREATE INDEX "QuoteGroup_clientId_idx" ON "QuoteGroup"("clientId");
CREATE INDEX "QuoteGroup_createdById_idx" ON "QuoteGroup"("createdById");
CREATE INDEX "QuoteGroup_updatedAt_idx" ON "QuoteGroup"("updatedAt");
CREATE INDEX "QuoteItem_sourceItemKey_idx" ON "QuoteItem"("sourceItemKey");
CREATE UNIQUE INDEX "QuoteApprovalOption_requestId_quoteId_key" ON "QuoteApprovalOption"("requestId", "quoteId");
CREATE UNIQUE INDEX "QuoteApprovalOption_requestId_position_key" ON "QuoteApprovalOption"("requestId", "position");
CREATE INDEX "QuoteApprovalOption_quoteId_idx" ON "QuoteApprovalOption"("quoteId");

ALTER TABLE "QuoteGroup"
    ADD CONSTRAINT "QuoteGroup_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteGroup"
    ADD CONSTRAINT "QuoteGroup_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "QuoteGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteApprovalOption"
    ADD CONSTRAINT "QuoteApprovalOption_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "QuoteApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteApprovalOption"
    ADD CONSTRAINT "QuoteApprovalOption_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
