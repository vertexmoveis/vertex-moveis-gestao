UPDATE "ProjectChecklistItem"
SET
  "label" = 'Medição',
  "position" = 1,
  "completedAt" = (
    SELECT MAX(source."completedAt")
    FROM "ProjectChecklistItem" source
    WHERE source."projectId" = "ProjectChecklistItem"."projectId"
      AND source."label" = 'Medição'
      AND source."completedAt" IS NOT NULL
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "position" = 1;

UPDATE "ProjectChecklistItem"
SET
  "label" = 'Projeto técnico',
  "position" = 2,
  "completedAt" = (
    SELECT MAX(source."completedAt")
    FROM "ProjectChecklistItem" source
    WHERE source."projectId" = "ProjectChecklistItem"."projectId"
      AND source."label" = 'Projeto técnico'
      AND source."completedAt" IS NOT NULL
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "position" = 2;

UPDATE "ProjectChecklistItem"
SET
  "label" = 'Produção',
  "position" = 3,
  "completedAt" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" = 'Produção'
        AND source."completedAt" IS NOT NULL
    ) THEN (
      SELECT MAX(source."completedAt")
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" = 'Produção'
        AND source."completedAt" IS NOT NULL
    )
    WHEN EXISTS (
      SELECT 1
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" IN ('Corte', 'Fita e acabamento', 'Montagem', 'Embalagem')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" IN ('Corte', 'Fita e acabamento', 'Montagem', 'Embalagem')
        AND source."completedAt" IS NULL
    ) THEN (
      SELECT MAX(source."completedAt")
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" IN ('Corte', 'Fita e acabamento', 'Montagem', 'Embalagem')
        AND source."completedAt" IS NOT NULL
    )
    ELSE NULL
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "position" = 3;

UPDATE "ProjectChecklistItem"
SET
  "label" = 'Entrega e instalação',
  "position" = 4,
  "completedAt" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" = 'Entrega e instalação'
        AND source."completedAt" IS NOT NULL
    ) THEN (
      SELECT MAX(source."completedAt")
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" = 'Entrega e instalação'
        AND source."completedAt" IS NOT NULL
    )
    WHEN EXISTS (
      SELECT 1
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" = 'Instalação'
        AND source."completedAt" IS NOT NULL
    ) THEN (
      SELECT MAX(source."completedAt")
      FROM "ProjectChecklistItem" source
      WHERE source."projectId" = "ProjectChecklistItem"."projectId"
        AND source."label" = 'Instalação'
        AND source."completedAt" IS NOT NULL
    )
    ELSE NULL
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "position" = 4;

DELETE FROM "ProjectChecklistItem"
WHERE "position" > 4;

UPDATE "ProjectEnvironment"
SET
  "completedAt" = COALESCE("completedAt", "updatedAt"),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('INSTALLED', 'COMPLETED')
  AND "completedAt" IS NULL;
