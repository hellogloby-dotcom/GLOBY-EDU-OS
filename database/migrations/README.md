# Migrations

Purpose: Version-controlled Prisma migration files. Keep each migration idempotent and reversible where possible.

Status: No Prisma migration has been generated yet. The current schema is preparation only; do not run a production migration until a clean Supabase database is intentionally provisioned and the schema has been reviewed.

Safe preparation commands:

```text
npx prisma validate --schema database/prisma/schema.prisma
npx prisma migrate dev --schema database/prisma/schema.prisma --name initial_schema
```

Never run `prisma migrate reset` against production.
