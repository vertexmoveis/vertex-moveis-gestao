# Prisma Upgrade Plan

## Goal

Upgrade Prisma from 5.x to the current supported major version without data loss.

## Risks

- Prisma 7 has breaking changes in configuration and generated client behavior.
- SQLite development behavior may differ from production database behavior.
- Migrations must be tested against a copy of production data.

## Steps

1. Back up the production database.
2. Create a staging database from a sanitized production snapshot.
3. Upgrade `prisma` and `@prisma/client` in a branch.
4. Run `npx prisma generate`.
5. Run `npx prisma migrate diff` or equivalent dry-run checks.
6. Run `npm run build`, `npm run lint`, and `npm run test:security`.
7. Run `npm run security:audit-data` against staging.
8. Deploy to preview and test login, RBAC, project/client CRUD, and seed blocking.

## Rollback

Restore the previous `package-lock.json`, `package.json`, and generated client. If a migration was applied, restore from backup or apply the tested rollback migration.
