# Controllers

Purpose: HTTP/GraphQL controllers convert transport-layer requests into application
commands and responses. Controllers should be thin and delegate to services.

Structure:
- `controllers/<module>/...` per domain module
- Keep validation and authentication middleware separate
