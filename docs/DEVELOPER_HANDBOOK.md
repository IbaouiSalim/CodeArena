# Developer Handbook

## What is CodeArena?

CodeArena safely runs code snippets in Docker containers as a web application (PWA).

**Stack:**
- Frontend: React + TypeScript + Vite + Monaco Editor
- Backend: Go 1.21 (standard library only)
- Infrastructure: Docker + Docker Compose + Traefik
- Database: SQLite

## How It Works

User types code → hits Run → sent to backend via HTTP/WebSocket → backend creates Docker container → code runs (10s timeout, 256MB memory) → results sent to browser → container discarded

## Architecture

User Browser (React PWA)
↓
Traefik Reverse Proxy (TLS, rate limiting)
↓
Backend (Go) + Frontend (React+Nginx)
↓
Docker Container Orchestrator
↓
Compiler Pool (Python, Go, C++, Rust, JavaScript)

## Project Structure

- `backend/` - Go service orchestrating Docker containers
  - `executor/` - Container spawning and resource limits
  - `ratelimit/` - IP-based rate limiting
  - `store/` - SQLite database for snippets
- `frontend/` - React application
  - `components/` - Editor, terminal, language selector
  - `utils/` - API calls, examples
- `infra/docker/` - Compiler images
- `docs/` - Documentation

## Development Setup

1. Clone and build:
```bash
git clone https://github.com/yourusername/codearena.git
cd codearena
make build-images
```

2. Backend (Terminal 1):
```bash
cd backend
go run .
```

Backend runs on http://localhost:8080

3. Frontend (Terminal 2):
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

4. Open http://localhost:5173 in browser

## Making Changes

### Backend (Go)

```bash
cd backend
go fmt ./...
go test ./... -v
go run .
```

### Frontend (React)

```bash
cd frontend
npm run lint
npm run format
npm run dev
npm run build
```

### Testing

```bash
# Backend
cd backend && go test ./... -v -coverprofile=coverage.out

# Frontend
cd frontend && npx vitest
cd frontend && npx playwright test
```

### Commit and push

```bash
git add .
git commit -m "feat: add feature"
git push origin branch-name
```

## Key Components

### executor/executor.go

This orchestrates Docker containers:

```go
New(cfg Config)  // Create executor with limits
Run(ctx context.Context, req Request)  // Run code
RunInteractive(conn *websocket.Conn, ...)  // Interactive mode
EnsureImages(ctx context.Context)  // Build images if missing
```

Main functions: spawns containers, enforces resource limits, handles WebSocket connections.

Adding a new language (e.g., Ruby):

1. Create `infra/docker/ruby.Dockerfile`:
```dockerfile
FROM ruby:latest
RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
```

2. Update `backend/executor/executor.go`:
```go
const LangRuby Language = "ruby"

case LangRuby:
    return "codearena-ruby"
```

3. Update supported languages check in `backend/main.go`

4. Update `frontend/src/types/index.ts`:
```typescript
export type Language = "go" | "python" | "cpp" | "rust" | "javascript" | "ruby";
```

5. Add example in `frontend/src/utils/snippets.ts`

### CodeEditor.tsx

The Monaco Editor component:

```typescript
interface CodeEditorProps {
  language: Language;
  code: string;
  onChange: (code: string) => void;
  readOnly?: boolean;
}
```

Monaco provides syntax highlighting based on language.

### ratelimit/ratelimit.go

Token bucket rate limiting:

```go
limiter = ratelimit.New(5, 15)  // 5 req/sec, burst 15

if !limiter.Allow(clientIP) {
    // Return HTTP 429
}
```

Adjust numbers to change rate limits (update Traefik too).

### store/store.go

SQLite database for snippets:

```sql
CREATE TABLE snippets (
    id INTEGER PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    stdin TEXT,
    title TEXT,
    created_at DATETIME default CURRENT_TIMESTAMP
)
```

To migrate to PostgreSQL:
1. Replace `sqlite3` import with `pgx`
2. Update connection string
3. Create migration files
4. Update SQL syntax

## API Reference

### POST /api/execute

Quick execution. Returns complete results.

Request:
```json
{
  "language": "python",
  "code": "print('hello')",
  "stdin": ""
}
```

Response:
```json
{
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "durationMs": 120,
  "wasTimeout": false
}
```

### WS /api/execute/ws

Interactive terminal with real-time streaming.

Flow:
1. Client opens WebSocket
2. Sends: `{"type":"start", "language":"python", "code":"..."}`
3. Server sends: `{"type":"stdout", "data":"Name: "}`
4. Client sends: `{"type":"stdin", "data":"Alice\n"}`
5. Server sends: `{"type":"exit", "exitCode":0}`

### POST /api/snippets

Save a snippet and get shareable token.

Request:
```json
{
  "language": "python",
  "code": "print('hello')",
  "stdin": "",
  "title": "Hello World"
}
```

Response:
```json
{ "token": "abc123xyz" }
```

### GET /api/snippets/{token}

Load a saved snippet.

Response:
```json
{
  "token": "abc123xyz",
  "language": "python",
  "code": "print('hello')",
  "stdin": "",
  "title": "Hello World",
  "createdAt": "2026-02-11T12:00:00Z"
}
```

## Debugging

Backend logs:
```bash
docker compose logs -f backend
docker compose logs backend | grep error
docker compose logs backend | grep timeout
```

Frontend: Open DevTools → Console, Network, Application tabs

WebSocket: DevTools → Network → Filter "WS"

Container shell:
```bash
docker compose exec backend sh
docker run -it codearena-python bash
docker stats
```

## Performance & Scaling

- Go reuses HTTP connections automatically
- Compiler images are pre-pulled
- SQLite queries are indexed
- Vite splits code into chunks
- Service Worker caches for offline
- Multi-stage Docker builds reduce image size

## Deployment

GitHub Actions on main:
1. Test (Go tests + Vitest + Playwright)
2. Build Docker images
3. SSH deploy to server

See `.github/workflows/deploy.yml`

## Security Checklist

- Validate user input (language, code size)
- Don't log sensitive data
- Error messages don't leak system info
- Containers run non-root
- Network disabled
- No secrets in `.env`

## Future Ideas

1. Side-by-side language comparison
2. Compiler options selection
3. Execution history
4. User accounts
5. Embed in docs (iframe)
6. WebAssembly support
7. Performance profiling
8. Custom packages

## Resources

- [Go Standard Library](https://pkg.go.dev/std)
- [React Docs](https://react.dev)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Traefik](https://doc.traefik.io/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## Contributing

1. Fork repo
2. Create branch: `git checkout -b fix/my-fix`
3. Make changes
4. Test: `npm test`, `go test ./...`
5. Commit: `git commit -m "fix: describe"`
6. Push and create Pull Request

## Questions?

- Bug: Open GitHub Issue
- Discussion: Use GitHub Discussions
- Help: Check wiki or ask in Discussions
