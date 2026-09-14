# GlobyEdu OS — Authentication & Authorization Overview

This document describes the authentication, multi-tenant, and RBAC architecture implemented in the repository.

Key components
- Backend: existing Express server (non-destructive). New auth module under `backend/modules/auth/`.
- Database: Prisma schema located at `database/prisma/schema.prisma` (auth models only).
- Tokens: JWT access tokens + refresh tokens; refresh tokens are stored hashed in the database.

Flow summary
- Login: user submits credentials to `/api/v1/auth/login` -> server validates -> returns `accessToken` and `refreshToken`.
- Access token: short-lived JWT used for protected endpoints.
- Refresh token: long-lived token rotated on use; stored hashed in DB to allow revocation.
- Forgot/Reset: `forgot-password` creates email token; `reset-password` consumes it.

Multi-tenant
- Each `User` references a `Tenant` using `tenantId`. `Tenant` stores `schoolId`, `name`, `timezone`, `branding`, and `status`.

RBAC
- Declarative roles and permissions stored using `Role`, `Permission`, `RolePermission`, and `UserRole` tables.
- Guard middleware `role.middleware.js` provides role checks; `auth.middleware.js` verifies JWTs.

Security notes
- Passwords are hashed with `bcrypt` (configurable rounds).
- Tokens are signed using secrets from environment variables found in `backend/config/auth.config.js`.
- Email sending is a stub; integrate a provider for production.

## Current development login flow

- The marketing SPA keeps the role-selection experience for Super Admin, School Authority, Teacher, and Student.
- Existing development email/password logins use `/api/v1/auth/platform-login` for Super Admin and `/api/v1/auth/school-login` for school users.
- The fallback development tenant is persisted in `backend/data/schools.json`; its accounts remain available when Firebase is not configured.
- The frontend stores the returned access token for the current development architecture. Passwords are never stored by the frontend.

## Firebase readiness

- Firebase web configuration is loaded at runtime from `GET /config/firebase.js`, using only public web configuration values.
- Firebase Admin uses `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` on the backend only. The private key is never sent to the browser.
- Optional Firebase email/password and Google client helpers already exist in `frontend/marketing/src/firebase/firebase-client.js`; Google sign-in remains opt-in and is not forced into the existing role forms.
- `POST /api/v1/auth/firebase-login` verifies the Firebase ID token server-side, then maps the Firebase email to an existing active server-side user and its stored role. Firebase claims and frontend routes cannot grant Super Admin access.
- Protected API routes continue to use JWT or development mock tokens, and now accept verified Firebase bearer tokens when Firebase Admin is configured.

Copy `.env.example` to `.env` and provide the Firebase values before enabling Firebase authentication. Leave them blank during local fallback development.

Developer notes
- Prisma client is wrapped at `backend/config/prisma.client.js` and gracefully falls back if `@prisma/client` is not installed.
- Migrations are not applied automatically; copy `database/prisma/.env.example` to set up local DB.
