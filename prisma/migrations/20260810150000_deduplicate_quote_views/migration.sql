UPDATE "QuoteApprovalRequest"
SET "viewCount" = CASE WHEN "viewedAt" IS NULL THEN 0 ELSE 1 END
WHERE "viewCount" <> CASE WHEN "viewedAt" IS NULL THEN 0 ELSE 1 END;

UPDATE "Quote"
SET "viewCount" = CASE WHEN "viewedAt" IS NULL THEN 0 ELSE 1 END
WHERE "viewCount" <> CASE WHEN "viewedAt" IS NULL THEN 0 ELSE 1 END;
