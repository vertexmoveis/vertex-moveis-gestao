CREATE SEQUENCE "Quote_number_seq";

ALTER TABLE "Client"
ADD COLUMN "document" TEXT;

ALTER TABLE "Quote"
ADD COLUMN "number" INTEGER,
ADD COLUMN "deliveryBusinessDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "firstInstallmentDate" TIMESTAMP(3);

WITH numbered_quotes AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS "number"
  FROM "Quote"
)
UPDATE "Quote"
SET "number" = numbered_quotes."number"
FROM numbered_quotes
WHERE "Quote"."id" = numbered_quotes."id";

SELECT setval(
  '"Quote_number_seq"',
  COALESCE((SELECT MAX("number") FROM "Quote"), 0) + 1,
  false
);

ALTER TABLE "Quote"
ALTER COLUMN "number" SET DEFAULT nextval('"Quote_number_seq"'),
ALTER COLUMN "number" SET NOT NULL;

ALTER SEQUENCE "Quote_number_seq" OWNED BY "Quote"."number";

CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

CREATE TABLE "CompanyProfile" (
  "id" TEXT NOT NULL DEFAULT 'vertex',
  "tradeName" TEXT NOT NULL DEFAULT 'Vertex Móveis',
  "legalName" TEXT,
  "document" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "street" TEXT,
  "number" TEXT,
  "complement" TEXT,
  "neighborhood" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zipCode" TEXT,
  "defaultDeliveryBusinessDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CompanyProfile" (
  "id",
  "tradeName",
  "legalName",
  "document",
  "phone",
  "email",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "zipCode",
  "defaultDeliveryBusinessDays",
  "updatedAt"
) VALUES (
  'vertex',
  'Vertex Móveis',
  'Vertex Ferragens',
  '39.778.558/0001-38',
  '(11) 94313-1992',
  'vertexmoveis@gmail.com',
  'Rua Saturno',
  '6',
  'Sala 2',
  'Recanto Vista Alegre',
  'Cotia',
  'SP',
  '06702-170',
  30,
  CURRENT_TIMESTAMP
);
