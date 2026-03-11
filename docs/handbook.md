# CodeArena – Developer Handbook & Installation Guide

## 1. Prerequisites

| Component | Minimum Version |
|-----------|----------------|
| Docker | 24.0+ with Compose v2 |
| Go | 1.21+ |
| Node.js | 20+ |
| Git | any recent version |

## 2. Installation

### 2.1 Clone and Build

```bash
git clone <repository-url>
cd codearena
make build-images      # builds all 5 compiler images
```

### 2.2 Local Development

**Backend** (terminal 1):
```bash
cd backend
go run .               # starts API on http://localhost:8080
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev            # starts dev server on http://localhost:5173
```

### 2.3 Docker Compose (Development)

```bash
docker compose up --build -d
```

This starts the backend (port 8080), frontend (port 5173), and builds all compiler images.

### 2.4 Production Deployment

```bash
export DOMAIN=codearena.example.com
export ACME_EMAIL=admin@example.com
docker compose -f docker-compose.prod.yml up --build -d
```

Production adds Traefik reverse proxy with automatic Let's Encrypt TLS, rate limiting, and HTTPS redirect.

**Firewall setup (Ubuntu):**
```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

## 3. Project Structure

```
backend/                  Go API server
├── main.go               HTTP routes, CORS, middleware
├── executor/             Docker container orchestration (batch + interactive)
├── store/                SQLite snippet storage
└── ratelimit/            Token-bucket rate limiter

frontend/                 React PWA (Vite + TypeScript)
├── src/components/       UI components (Editor, Terminal, ShareButton, …)
├── src/pages/            EditorPage (main view)
├── src/utils/            API client, snippet data
├── src/types/            TypeScript interfaces
├── e2e/                  Playwright E2E tests
└── public/               PWA manifest, service worker, icons

infra/docker/             Compiler Dockerfiles (one per language)
docs/                     Requirements, architecture, API contract, security
```

## 4. Build Targets (Makefile)

| Target | Description |
|--------|-------------|
| `make all` | Build backend + frontend + compiler images |
| `make build-backend` | Compile Go binary (CGO disabled) |
| `make build-frontend` | `npm ci` + Vite production build |
| `make build-images` | Build all 5 compiler Docker images |
| `make dev` | Run backend + frontend dev servers |
| `make test` | Run all tests (Go + Vitest) |
| `make test-e2e` | Run Playwright E2E tests |
| `make lint` | ESLint + Prettier check |
| `make up` / `make down` | Docker Compose up/down |
| `make clean` | Remove build artifacts |

## 5. API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/execute` | Batch code execution |
| WS | `/api/execute/ws` | Interactive execution (WebSocket) |
| POST | `/api/snippets` | Store snippet, returns share token |
| GET | `/api/snippets/{token}` | Load shared snippet |

Full request/response schemas: see [api.md](api.md).

## 6. Testing

**Backend (Go):**
```bash
cd backend && go test ./... -v -count=1 -coverprofile=coverage.out
```

**Frontend (Vitest):**
```bash
cd frontend && npx vitest run --coverage
```

**E2E (Playwright):**
```bash
cd frontend && npx playwright test
```

Tests are also run automatically in CI via GitHub Actions on every push/PR to `main`.

## 7. Code Style

- **Frontend:** ESLint + Prettier. Run `npm run format` to auto-format, `npm run lint` to check.
- **Backend:** Standard Go formatting via `gofmt -w .`

## 8. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on pushes to `main`:

1. **test-backend** – Go tests with coverage
2. **test-frontend** – Vitest + lint
3. **build** – Builds all Docker images (compiler + backend + frontend)
4. **deploy** – SSH into VPS, pulls latest code, restarts via `docker compose`

## 9. Environment Variables

| Variable | Used In | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | Backend | Allowed CORS origin (default: `http://localhost:5173`) |
| `CODEARENA_DB_PATH` | Backend | SQLite database path (default: `codearena.db`) |
| `DOMAIN` | Production | Domain for Traefik routing and TLS |
| `ACME_EMAIL` | Production | Email for Let's Encrypt certificate registration |

## 10. Adding a New Language

1. Create a Dockerfile in `infra/docker/` (follow existing pattern: base image, create `runner` user, set workdir).
2. Add the language entry to the `imageMap` and `buildCommand` function in `backend/executor/executor.go`.
3. Add a Monaco language ID mapping and default code in `frontend/src/pages/EditorPage.tsx`.
4. Add the language to the `LANGUAGES` array in `frontend/src/components/LanguageSelector.tsx`.
5. Add example snippets in `frontend/src/utils/snippets.ts`.
6. Update the Makefile `build-images` target and the CI workflow to build the new image.
