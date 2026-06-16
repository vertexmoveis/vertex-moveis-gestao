# Auth.js Migration Plan

## Goal

Move from `next-auth` v4 to current Auth.js without changing authorization semantics.

## Risks

- Session/JWT callback types and route exports may change.
- Credentials provider behavior and cookie names may change.
- Existing tests for `401`, `403`, IDOR, and rate limit must continue passing.

## Steps

1. Create a branch and capture current `npm run build`, `npm run lint`, and `npm run test:security` output.
2. Read the Auth.js migration guide for the exact target version.
3. Update dependencies in a single commit.
4. Port `authOptions` and route handler exports.
5. Verify session payload still includes `id` and `role`.
6. Re-run security tests and manual login.
7. Deploy to preview with real Redis rate limit configured.

## Rollback

Revert the dependency and auth migration commit. Confirm `next-auth` v4 lockfile entries are restored and rerun `npm ci`, `npm run build`, and `npm run test:security`.
