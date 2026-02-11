# CodeArena

CodeArena is a Progressive Web App (PWA) that allows users to run small code snippets (Go, Python, C++) securely in isolated containers and share them via short links.

## Tech Stack
- Frontend: React + Vite + TypeScript + Monaco Editor (PWA)
- Backend: Go (net/http) + Docker SDK (container orchestration)
- Database: PostgreSQL or SQLite (snippets + sharing)
- Infra: Docker Compose + Traefik (or Nginx) + HTTPS (Let's Encrypt)

## Status
Week 2: Requirements, security concept, and API contract.

## Repository Structure
- `frontend/` React app (later)
- `backend/` Go API (later)
- `infra/` docker-compose, reverse proxy config (later)
- `docs/` requirements + security + API contract
