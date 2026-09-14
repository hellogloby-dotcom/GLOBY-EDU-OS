# Deployment

Purpose: Infrastructure as code, Kubernetes manifests, Helm charts, and CI/CD.

Structure suggestion:
- `deployment/k8s/` — Kubernetes manifests
- `deployment/terraform/` — Terraform infra code
- `deployment/cicd/` — pipeline templates

Do not store secrets in repo; use secret manager integrations.
