# CodeArena – System Architecture

## 1. High-Level Overview

CodeArena consists of four main components:

1. **Frontend** – React 19 + Vite + TypeScript + Monaco Editor (PWA)
2. **Backend** – Go HTTP/WebSocket server (net/http, Docker SDK, gorilla/websocket)
3. **Execution Layer** – Isolated Docker containers per run (one image per language)
4. **Database** – SQLite (via modernc.org/sqlite, pure Go, no CGo)

---

## 2. Component Flow

User → Frontend → Backend → Docker Container → Backend → Frontend → User

### Batch Execution Flow (POST /api/execute)

1. User writes code in Monaco Editor.
2. Frontend sends `POST /api/execute` with language, code, and optional stdin.
3. Backend selects Docker image, starts container, applies resource limits.
4. Container runs code, backend captures stdout/stderr.
5. Backend stops and removes container, returns JSON response.
6. Frontend displays output, exit code, and duration.

### Interactive Execution Flow (WebSocket /api/execute/ws)

1. User clicks **Run** → frontend opens WebSocket to `/api/execute/ws`.
2. Frontend sends a `start` message with language and code.
3. Backend creates a Docker container with a PTY attached.
4. stdout/stderr are streamed in real-time to the frontend via WebSocket messages.
5. User can type stdin input in the terminal — sent as `stdin` messages through the WebSocket.
6. When the process exits (or times out), backend sends an `exit` message with exit code and duration.
7. Container is removed; WebSocket closes.

The interactive mode is the **primary execution mode** in the current UI.

---

## 3. Container Strategy

- One Docker image per language:
  - `codearena-python` – Python 3.12
  - `codearena-go` – Go 1.23
  - `codearena-cpp` – GCC 13 (g++)
  - `codearena-rust` – Rust 1.83
  - `codearena-javascript` – Node.js 22
- Each execution:
  - Runs in a fresh container (removed after completion)
  - Non-root user (`runner`)
  - No network access (`NetworkMode: "none"`)
  - No volume mounts (no host filesystem access)
  - Resource limits: 256 MB RAM, 1 CPU core, 256 PIDs, 10s timeout
  - Output truncated at 64 KB

---

## 4. Database Usage

SQLite database (`codearena.db`) stores:
- Snippet code
- Language
- Stdin
- Title
- Creation timestamp
- Share token (12 hex chars, 6 random bytes)

The share token is used to build short links: `/s/{token}`.

---

## 5. Rate Limiting

Two layers of rate limiting protect the API:
1. **Application-level:** Token-bucket per IP (5 req/s, burst 15) on `/api/execute` and `/api/snippets`.
2. **Reverse proxy:** Traefik rate limiting middleware (10 avg, 20 burst) in production.

---

## 6. Reverse Proxy

Traefik v3.2 in production (`docker-compose.prod.yml`):
- Automatic TLS via Let's Encrypt
- HTTP → HTTPS redirect
- Rate limiting middleware
- Routes traffic to backend (API) and frontend (static files)

---

## 7. Deployment Overview

Production server:
- Ubuntu 22.04 LTS
- Docker Engine + Docker Compose v2
- Traefik reverse proxy (containerized)
- Firewall (ufw: ports 22, 80, 443 only)
- CI/CD via GitHub Actions (test → build → SSH deploy)

