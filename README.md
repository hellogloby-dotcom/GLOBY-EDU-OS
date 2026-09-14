<!--
  GlobyEdu OS - The Operating System for Modern Schools
  Root README: high-level project overview, vision, folder structure,
  development rules, and contribution guidelines.
  This file is the first point of reference for developers and stakeholders.
-->

# GlobyEdu OS

## Project Overview

GlobyEdu OS is an AI-powered, multi-tenant School Management and Learning Operating System.

This repository contains the initial, enterprise-grade project structure and starter files.

## Vision

To provide a secure, scalable, and modular platform that empowers schools worldwide
with modern tools for administration, teaching, learning, and analytics.

## Folder Structure

- `frontend/` — UI application (React + TypeScript recommended)
- `backend/` — API server and services (Node.js + TypeScript recommended)
- `api/` — API specifications (OpenAPI, GraphQL schema)
- `database/` — migrations, schema, seeds
- `modules/` — business modules (school, student, teacher, etc.)
- `ai/` — AI models, pipelines, and training infra
- `deployment/` — Kubernetes/terraform/CD manifests
- `docs/` — architecture, onboarding, and runbooks
- `scripts/` — development and maintenance scripts
- `tests/` — integration, e2e, and unit test harnesses
- `configs/` — central configuration templates

Refer to each folder's README for detailed purpose and starter guidance.

## Development Rules

- No application logic in this scaffold.
- Keep modules small and loosely coupled.
- Follow API-first design.
- Write clear comments and docs in every new file.

## Coding Standards

- TypeScript preferred for backend and frontend.
- Strict typing and linting enabled.
- Use the shared `types/` and `utils/` modules for common code.

## Naming Conventions

- `PascalCase` for classes and React components.
- `camelCase` for variables and functions.
- `kebab-case` for file names and URLs.

## Git Workflow

- `main` protected: PRs + code review
- Feature branches: `feat/<area>-<short-desc>`
- Release branches: `release/<version>`

## Future Roadmap

- Phase 1: Project scaffolding and core platform APIs
- Phase 2: Multi-tenant isolation, auth, core modules
- Phase 3: AI teacher & tutoring features
- Phase 4: Marketplace & plugins
