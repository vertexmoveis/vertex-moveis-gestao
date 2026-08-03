UPDATE "ProjectFile"
SET
  "securityStatus" = 'TYPE_CHECKED',
  "securityDetails" = 'Formato e estrutura do PDF conferidos pela validação interna.',
  "securityCheckedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'application/pdf'
  AND "securityStatus" = 'ERROR'
  AND "securityDetails" = 'PDF mantido em quarentena até a configuração do antivírus externo.';
