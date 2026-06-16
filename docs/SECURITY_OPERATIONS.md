# Security Operations

## Shared Rate Limit

Production deployments must configure a shared Redis-compatible backend:

```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

If these variables are absent in `NODE_ENV=production`, rate-limited APIs fail closed with `503` and Credentials login is denied. Local development uses an in-memory limiter only outside production.

The only production-mode memory exception is `SECURITY_TEST_MODE=true` with `NEXTAUTH_URL` pointing to `localhost` or `127.0.0.1`, used by `npm run test:security`.

## First Admin

Provision the first admin from a trusted local shell or one-off private job:

```bash
set DATABASE_URL=file:./dev.db
set ADMIN_EMAIL=owner@example.com
set ADMIN_PASSWORD=<strong password>
npm run admin:provision
```

Password policy: at least 14 characters, uppercase, lowercase, number, and symbol.

If an admin already exists, the script refuses to continue unless this is explicitly intentional:

```bash
set CONFIRM_OVERWRITE_ADMIN=true
npm run admin:provision
```

The script never prints password hashes or secrets.

## Demo Users

List suspicious demo/test users:

```bash
npm run security:demo-users -- --action=list
```

Force password reset for suspicious users:

```bash
set CONFIRM_DEMO_USER_ACTION=true
npm run security:demo-users -- --action=reset-password
```

Disable suspicious users by replacing their login email with a disabled local address and resetting the password:

```bash
set CONFIRM_DEMO_USER_ACTION=true
npm run security:demo-users -- --action=disable
```

Delete suspicious users only after checking foreign-key impact:

```bash
set CONFIRM_DEMO_USER_ACTION=true
npm run security:demo-users -- --action=delete
```

## Test Data Audit

Run a masked report for demo/test data:

```bash
npm run security:audit-data
```

The report masks email and phone values and does not print hashes, tokens, or full PII.
