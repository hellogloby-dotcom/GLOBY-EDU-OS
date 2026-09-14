# School Core System — Architecture and Usage

This document explains the School Core System (tenant) implemented in the repository.

Model
- Reuse `Tenant` model in `database/prisma/schema.prisma` as the canonical School model.
- Key fields: `schoolId`, `name`, `branding`, `status`, `subscription`, `country`, `timezone`, `createdAt`, `updatedAt`.

API Endpoints
- `POST /api/v1/schools` — Create school (Super Admin only)
- `GET /api/v1/schools` — List schools (Super Admin only)
- `GET /api/v1/schools/:schoolId` — Get details (School Admin or Super Admin)
- `PUT /api/v1/schools/:schoolId` — Update school (School Admin or Super Admin)
- `DELETE /api/v1/schools/:schoolId` — Soft suspend (Super Admin only)
- `GET /api/v1/schools/:schoolId/summary` — Tenant-scoped dashboard summary

Tenant Isolation
- Requests are authenticated with JWT; `req.user` includes `tenantId` and `roles`.
- `tenant.middleware.js` enforces the tenant match for tenant-scoped endpoints and attaches `req.tenant`.
- Super Admin users (role `super_admin`) bypass tenant checks and can manage global data.

School Lifecycle
- Created → Active (default trial) → Subscription changes → Suspended/Expired
- Soft delete sets `status` to `suspended`; physical deletion is avoided.

Branding
- `branding` is stored as JSON allowing future customization (colors, logos, theme).

Next steps
- Seed default roles and permissions.
- Implement onboarding flow to create default Headmaster user on school creation.
