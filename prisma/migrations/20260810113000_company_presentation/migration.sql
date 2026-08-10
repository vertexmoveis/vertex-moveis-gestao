ALTER TABLE "CompanyProfile"
ADD COLUMN "presentationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "presentationHeading" TEXT NOT NULL DEFAULT 'Móveis planejados para o seu espaço',
ADD COLUMN "presentationText" TEXT NOT NULL DEFAULT 'Projetamos e produzimos móveis sob medida, com acompanhamento até a instalação.',
ADD COLUMN "presentationHighlight1" TEXT NOT NULL DEFAULT 'Móveis planejados sob medida',
ADD COLUMN "presentationHighlight2" TEXT NOT NULL DEFAULT 'Orçamento claro e detalhado',
ADD COLUMN "presentationHighlight3" TEXT NOT NULL DEFAULT 'Acompanhamento até a instalação';

ALTER TABLE "QuoteApprovalRequest"
ADD COLUMN "pdfViewedAt" TIMESTAMP(3),
ADD COLUMN "pdfViewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CompanyPresentationImage" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL DEFAULT 'vertex',
  "environmentName" TEXT NOT NULL DEFAULT 'Todos os ambientes',
  "name" TEXT NOT NULL,
  "caption" TEXT,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "size" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "securityStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "securityDetails" TEXT,
  "securityCheckedAt" TIMESTAMP(3),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyPresentationImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyPresentationImage_url_key" ON "CompanyPresentationImage"("url");
CREATE INDEX "CompanyPresentationImage_companyId_active_environmentName_position_idx"
ON "CompanyPresentationImage"("companyId", "active", "environmentName", "position");

ALTER TABLE "CompanyPresentationImage"
ADD CONSTRAINT "CompanyPresentationImage_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
