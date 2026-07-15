-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "material" TEXT,
    "finish" TEXT,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "depth" REAL,
    "difficulty" TEXT NOT NULL DEFAULT 'NORMAL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "areaM2" REAL NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuoteItem" ("areaM2", "cost", "createdAt", "depth", "description", "environment", "finish", "height", "id", "material", "notes", "position", "quantity", "quoteId", "total", "unitPrice", "updatedAt", "width") SELECT "areaM2", "cost", "createdAt", "depth", "description", "environment", "finish", "height", "id", "material", "notes", "position", "quantity", "quoteId", "total", "unitPrice", "updatedAt", "width" FROM "QuoteItem";
DROP TABLE "QuoteItem";
ALTER TABLE "new_QuoteItem" RENAME TO "QuoteItem";
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX "QuoteItem_environment_idx" ON "QuoteItem"("environment");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
