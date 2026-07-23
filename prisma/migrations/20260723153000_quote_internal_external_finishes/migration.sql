UPDATE "QuotePriceRule"
SET "name" = 'Cozinha madeirada externa',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Cozinha madeirada'
  AND "environment" = 'Cozinha'
  AND "priceProfile" = 'WOODGRAIN';

UPDATE "QuotePriceRule"
SET "name" = 'Cozinha provençal externa',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Cozinha provençal'
  AND "environment" = 'Cozinha'
  AND "priceProfile" = 'PROVENCAL';

UPDATE "QuotePriceRule"
SET "name" = 'Armário de quarto madeirado externo',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Armário de quarto madeirado'
  AND "environment" = 'Dormitório'
  AND "priceProfile" = 'WOODGRAIN';

UPDATE "MaterialCatalogItem"
SET "defaultFinish" = 'Branco interno',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'MDF'
  AND "defaultFinish" IN ('Branco TX', 'Branco interno');

UPDATE "MaterialCatalogItem"
SET "defaultFinish" = 'Madeirado interno',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'MDF madeirado'
  AND "defaultFinish" IN ('Madeirado', 'Madeirado interno');
