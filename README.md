# CodeArena

**CodeArena** is a Progressive Web App (PWA) for running code snippets in isolated Docker containers. It supports **Go, Python, C++, Rust, and JavaScript**, features a Monaco-based code editor, an interactive WebSocket terminal, snippet sharing via short links, and a built-in example library.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript 5 + Monaco Editor |
| Backend | Go (net/http, Docker SDK, gorilla/websocket) |
| Database | SQLite (via modernc.org/sqlite, pure Go) |
| Infra | Docker Compose, Traefik reverse proxy, Let's Encrypt TLS |
| CI/CD | GitHub Actions → SSH deploy to VPS |

## Repository Structure

```
├── backend/               Go API server (orchestrator)
│   ├── main.go            HTTP/WebSocket routes, CORS, rate limiting
│   ├── executor/          Docker container orchestration
│   ├── store/             SQLite snippet persistence
│   └── ratelimit/         Token-bucket rate limiter
├── frontend/              React PWA
│   ├── src/
│   │   ├── components/    Editor, Terminal, LanguageSelector, ShareButton, …
│   │   ├── pages/         EditorPage (main view)
│   │   ├── types/         TypeScript type definitions
│   │   └── utils/         API helpers, snippet data
│   ├── e2e/               Playwright E2E tests
│   └── public/            PWA manifest, service worker, icons
├── infra/docker/          Compiler Dockerfiles (one per language)
├── docs/                  Requirements, architecture, API contract, security
├── docker-compose.yml     Development setup
├── docker-compose.prod.yml  Production setup (Traefik + TLS)
├── Makefile               Build automation
└── .github/workflows/     CI/CD pipeline
```

---

## Prerequisites

- **Docker** ≥ 24.0 with Docker Compose v2
- **Go** ≥ 1.21 (for local backend development)
- **Node.js** ≥ 20 (for local frontend development)
- **Git**

---

## Installation & Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/codearena.git
cd codearena
```

### 2. Build compiler images

These are the sandboxed Docker images used to run user code:

```bash
make build-images
```

This builds five images: `codearena-python`, `codearena-go`, `codearena-cpp`, `codearena-rust`, `codearena-javascript`.

### 3. Start in development mode

**Backend** (terminal 1):
```bash
cd backend
go run .
```
The API starts on `http://localhost:8080`.

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```
The dev server starts on `http://localhost:5173`.

### 4. Start with Docker Compose (alternative)

```bash
docker compose up --build -d
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

---

## Production Deployment

### Using Docker Compose + Traefik

1. Set environment variables:
   ```bash
   export DOMAIN=codearena.example.com
   export ACME_EMAIL=admin@example.com
   ```

2. Deploy:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

   This starts:
   - **Traefik** reverse proxy with automatic Let's Encrypt TLS
   - **Backend** with rate limiting (application-level + Traefik-level)
   - **Frontend** served via Nginx

3. Firewall (Ubuntu):
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

### CI/CD

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on pushes to `main`:
1. Runs Go backend tests with coverage
2. Runs frontend Vitest + lint
3. Builds all Docker images
4. Deploys to VPS via SSH

---

## Development Guide

### Make targets

```
make all              # Build backend + frontend + compiler images
make build-backend    # Compile Go binary
make build-frontend   # npm ci + Vite production build
make build-images     # Build all 5 compiler Docker images
make dev              # Run backend + frontend in dev mode
make test             # Run all tests (backend + frontend)
make test-backend     # Go tests only
make test-frontend    # Vitest only
make test-e2e         # Playwright E2E tests
make lint             # ESLint + Prettier check
make up               # docker compose up --build -d
make down             # docker compose down
make clean            # Remove build artifacts
```

### Running tests

**Backend (Go):**
```bash
cd backend && go test ./... -v
```

**Frontend (Vitest):**
```bash
cd frontend && npx vitest run
```

**E2E (Playwright):**
```bash
cd frontend && npx playwright test
```

### Code style

- **Frontend:** ESLint + Prettier enforced. Run `npm run format` to auto-format, `npm run lint` to check.
- **Backend:** Standard Go formatting. Run `gofmt -w .` to format.

### API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/execute` | Execute code (batch mode) |
| WS | `/api/execute/ws` | Interactive execution (WebSocket) |
| POST | `/api/snippets` | Store snippet, returns share token |
| GET | `/api/snippets/{token}` | Load shared snippet |

See [docs/api.md](docs/api.md) for full request/response schemas.

### Architecture

See [docs/architecture.md](docs/architecture.md) for the system design and container strategy.

### Security

See [docs/security.md](docs/security.md) for the isolation model, resource limits, and threat analysis.

---

## Supported Languages

| Language | Runtime | Docker Image |
|---|---|---|
| Python | 3.12 | `codearena-python` |
| Go | 1.23 | `codearena-go` |
| C++ | GCC 13 | `codearena-cpp` |
| Rust | 1.83 | `codearena-rust` |
| JavaScript | Node.js 22 | `codearena-javascript` |

---

## License

[MIT](LICENSE)
