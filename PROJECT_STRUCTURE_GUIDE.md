# CodeArena - Complete Project Structure Guide

## Overview

**CodeArena** is a web-based code execution platform that lets users write and run code snippets in different programming languages directly from a browser. It's a **Progressive Web App (PWA)** that safely executes code in isolated Docker containers.

**Key Value Proposition:**
- Write code in the browser using Monaco Editor
- Execute instantly in isolated Docker containers
- Support for 5 languages: Python, Go, C++, Rust, JavaScript
- Share snippets with shareable links
- Interactive terminal with live input/output
- Rate limiting and resource constraints (10s timeout, 256MB memory)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ User Browser (React PWA - Port 5173)                               │
│ ├─ Editor Component (Monaco)                                        │
│ ├─ Language Selector                                                │
│ ├─ Interactive Terminal (WebSocket)                                 │
│ ├─ Share Button (generates shareable link)                          │
│ └─ Snippet Library                                                  │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ HTTP & WebSocket
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ Go Backend (HTTP Server - Port 8080)                              │
│ ├─ executor/     → Docker container orchestration                │
│ ├─ store/        → SQLite database for snippets                  │
│ ├─ ratelimit/    → IP-based rate limiting                        │
│ └─ main.go       → HTTP handlers & middleware                    │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ Docker API
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ Docker Daemon                                                     │
│ ├─ codearena-python (Python 3.12)                               │
│ ├─ codearena-go (Go 1.23)                                        │
│ ├─ codearena-cpp (C++ GCC 13)                                    │
│ ├─ codearena-rust (Rust 1.83)                                    │
│ └─ codearena-javascript (Node 22)                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## File Structure Breakdown

### Root Level Files

| File | Purpose |
|------|---------|
| **Makefile** | Build automation - compile backend, frontend, Docker images |
| **docker-compose.yml** | Local development - starts backend (8080), frontend (5173), Docker proxy, compiler images |
| **docker-compose.prod.yml** | Production setup - Traefik reverse proxy, TLS, Let's Encrypt |
| **LICENSE** | MIT License |
| **README.md** | Quick start guide and documentation links |

---

## Backend (`backend/` Directory)

The backend is written in **Go 1.24** using only the standard library plus minimal external deps (Docker client, WebSocket, SQLite).

### Main Backend Files

#### `main.go` (Entry Point)
**Purpose:** HTTP server initialization and route handlers

**Key Responsibilities:**
1. **Initialize modules:**
   - `executor.New()` - Docker executor for running code
   - `store.New()` - SQLite database connection
   - `ratelimit.New()` - Rate limiter (5 requests/sec, burst of 15)

2. **Ensure Docker images exist** - Calls `executor.EnsureImages()` to download/build container images

3. **Setup HTTP routes:**
   - `GET /api/health` → Health check endpoint
   - `POST /api/execute` → Run code synchronously
   - `WS /api/execute/ws` → WebSocket for interactive execution
   - `POST /api/snippets` → Save code snippet
   - `GET /api/snippets/{token}` → Retrieve saved snippet

4. **CORS middleware** - Allows cross-origin requests from frontend

**Key Functions:**
- `cors()` - Wraps handlers with CORS headers
- `healthHandler()` - Returns `{"status": "ok"}`
- `executeHandler()` - Receives code, runs it, returns result
- `wsExecuteHandler()` - Upgrades HTTP to WebSocket, streams output
- `snippetsHandler()` - POST saves snippets, returns unique token
- `snippetByTokenHandler()` - GET retrieves saved snippets

**Important Code Flows:**
```go
// Request flow for code execution
Request → executeHandler
  ↓
Parse JSON (language, code, stdin)
  ↓
Validate language
  ↓
exec.Run() → waits for completion
  ↓
Return JSON result (stdout, stderr, exitCode, durationMs, wasTimeout)
```

---

#### `executor/executor.go` (Container Orchestration)
**Purpose:** Manages Docker containers, enforces resource limits, compiles code

**Key Data Structures:**
```go
type Language string  // "python", "go", "cpp", "rust", "javascript"

type Config struct {
    Timeout    10 * time.Second  // Kill container if running too long
    MemoryMB   256               // Memory limit
    CPUCount   1                 // CPU cores allowed
    MaxOutput  64KB              // Max output size
}

type Request struct {
    Language Language  // Which language to run
    Code     string    // Source code to execute
    Stdin    string    // Standard input for the program
}

type Result struct {
    Stdout     string  // Program output
    Stderr     string  // Error output
    ExitCode   int     // 0 = success, non-zero = error
    DurationMs int64   // How long it ran
    WasTimeout bool    // Was killed for timeout?
}
```

**Image Mapping:**
```go
codearena-python      → LangPython
codearena-go          → LangGo
codearena-cpp         → LangCpp
codearena-rust        → LangRust
codearena-javascript  → LangJavascript
```

**Key Methods:**

1. **`New(cfg Config)`** - Create executor, connect to Docker daemon
   - Validates Docker connection with `Ping()`
   - Returns error if Docker is not running

2. **`EnsureImages(ctx context.Context)`** - Download/build compiler images
   - For each language, checks if image exists locally
   - Pulls from Docker Hub if missing
   - Called on startup

3. **`Run(ctx context.Context, req Request)`** - Execute code synchronously
   - Creates container with code + stdin
   - Waits for completion (max 10 seconds)
   - Returns result with stdout/stderr
   - **Container is automatically removed after execution**

4. **`Close()`** - Close Docker client connection

**Container Configuration:**
```go
containerCfg := &container.Config{
    Image: imgName,           // e.g., "codearena-python"
    Cmd: buildCommand(...),   // See next section
    AttachStdout: true,       // Capture output
    AttachStderr: true,       // Capture errors
    NetworkDisabled: true,    // SECURITY: No network access
    User: "runner",           // Non-root user
}

hostCfg := &container.HostConfig{
    NetworkMode: "none",      // No network
    Memory: 256 * 1024 * 1024,       // 256MB max
    MemorySwap: 256 * 1024 * 1024,   // No swap
    NanoCPUs: 1e9,                   // 1 CPU core
    PidsLimit: 256,                  // Max 256 processes
    AutoRemove: false,        // We remove manually in defer
}
```

---

#### `executor/interactive.go` (WebSocket Stream Execution)
**Purpose:** Stream code execution over WebSocket for interactive input/output

**Key Data Structure:**
```go
type WsMessage struct {
    Type       string  // "start", "input", "output", "stderr", "error", "exit"
    Data       string  // Output data for "output" and "stderr"
    Language   string  // "python", "go", etc.
    Code       string  // Source code (in "start" message)
    ExitCode   int     // Exit code (in "exit" message)
    DurationMs int64   // Duration (in "exit" message)
    WasTimeout bool    // Timeout flag (in "exit" message)
    Message    string  // Error message (in "error" message)
}
```

**Message Protocol:**
```
Client sends:  {"type": "start", "language": "python", "code": "print(input())"}
   ↓
Container starts, sends output over WebSocket
   ↓
Client sends: {"type": "input", "data": "Hello\n"}
   ↓
Container receives input, prints it
   ↓
Container exits:
Server sends: {"type": "exit", "exitCode": 0, "durationMs": 125, "wasTimeout": false}
```

**Key Method:**

1. **`RunInteractive(ws *websocket.Conn, lang Language, code string)`**
   - Creates container with TTY (terminal) enabled
   - Allows bidirectional communication over WebSocket
   - Streams stdout/stderr in real-time
   - Accepts stdin from WebSocket messages
   - Sends exit info when container finishes

---

#### `store/store.go` (SQLite Database)
**Purpose:** Persist code snippets with unique shareable tokens

**Database Schema:**
```sql
CREATE TABLE snippets (
    token      TEXT PRIMARY KEY,        -- Unique 12-char hex ID
    language   TEXT NOT NULL,           -- "python", "go", etc.
    code       TEXT NOT NULL,           -- The user's code
    stdin      TEXT DEFAULT '',         -- Input for the program
    title      TEXT DEFAULT '',         -- Snippet title/description
    created_at TEXT NOT NULL            -- ISO 8601 timestamp
)
```

**Key Methods:**

1. **`New(dbPath string)`** - Open/create database
   - Opens at `codearena.db` by default
   - Enables WAL (Write-Ahead Logging) for concurrency
   - Creates table if it doesn't exist

2. **`Create(language, code, stdin, title string)`** - Save new snippet
   - Generates random 6-byte token (hex-encoded = 12 chars)
   - Example token: `a3f7b2e1c9d8`
   - Returns token so user can share `example.com/s/a3f7b2e1c9d8`

3. **`Get(token string)`** - Retrieve snippet by token
   - Returns all fields as `Snippet` struct
   - Returns `nil` if not found (404 in API)

4. **`Close()`** - Close database connection

**Token Format:**
- 6 random bytes → 12 hex characters
- Example: `"a3f7b2e1c9d8"`
- Probability of collision: extremely low for reasonable usage

---

#### `ratelimit/ratelimit.go` (IP-Based Rate Limiting)
**Purpose:** Prevent abuse by limiting requests per IP address

**Algorithm:** Token Bucket
- Each IP starts with a "bucket" of tokens
- Tokens refill at a rate (5 tokens/second by default)
- Maximum tokens in bucket = burst (15 by default)
- Each request costs 1 token
- If no tokens left, request denied with HTTP 429

**Key Data Structures:**
```go
type visitor struct {
    tokens   float64   // How many requests can this IP make?
    lastSeen time.Time // When we last saw this IP?
}

type Limiter struct {
    visitors map[string]*visitor  // IP → bucket state
    rate     float64              // Tokens/second (5)
    burst    int                  // Max tokens (15)
}
```

**Key Methods:**

1. **`New(rate float64, burst int)`** - Create limiter
   - `rate=5` → 5 requests per second
   - `burst=15` → Can do up to 15 at once, then must wait
   - Starts background cleanup goroutine

2. **`Allow(ip string)`** - Check if IP can make request
   - Calculates tokens added since last request
   - Subtracts 1 token for this request
   - Returns true if allowed, false if rate-limited
   - Example: 5 tokens/sec means normal usage is `1 request every 200ms`

3. **`Middleware(next http.HandlerFunc)`** - HTTP middleware
   - Extracts IP from `Request.RemoteAddr`
   - Checks `X-Forwarded-For` header (for reverse proxy)
   - Calls `Allow(ip)` to check rate limit
   - Returns HTTP 429 if exceeded

4. **`cleanup()`** - Background goroutine (runs every minute)
   - Removes IPs not seen in 3 minutes
   - Prevents memory leaks

---

### Backend Dependencies (`go.mod`)

```
github.com/docker/docker       → Docker client to create/manage containers
github.com/gorilla/websocket   → WebSocket support for interactive execution
modernc.org/sqlite             → Pure-Go SQLite implementation
```

No external HTTP framework needed - uses Go standard library `net/http`

---

## Frontend (`frontend/` Directory)

The frontend is a **React + TypeScript** PWA using **Vite** for bundling and **Monaco Editor** for code editing.

### Build Configuration Files

#### `package.json`
**Dependencies:**
- `@monaco-editor/react` (v4.7.0) - Code editor component
- `monaco-editor` (v0.55.1) - Editor engine
- `react` (v19.2.0) - UI framework
- `react-router-dom` (v7.13.1) - Page routing
- `lucide-react` (v0.575.0) - Icons

**Dev Dependencies:**
- `vitest` - Unit testing
- `@playwright/test` - E2E testing
- `typescript` - Type checking
- `eslint` - Code linting
- `vite` - Build tool

**Scripts:**
- `npm run dev` - Start dev server (hot reload)
- `npm run build` - Build for production
- `npm run test` - Run unit tests
- `npm run format` - Auto-format code
- `npm run lint` - Check code style

#### `tsconfig.json` & `tsconfig.app.json`
- TypeScript configuration
- Strict mode enabled
- Target ES2020

#### `vite.config.ts`
- Entry point: `src/main.tsx`
- Output: `dist/`
- Dev server port: 5173

#### `vitest.config.ts`
- Unit test runner
- jsdom environment (simulate browser)
- Coverage with v8

#### `playwright.config.ts`
- E2E test configuration
- Tests in `e2e/` directory
- Chrome + Firefox browsers

---

### Frontend Structure

#### `src/main.tsx` (Entry Point)
- Mount React app to DOM element
- Initialize Vite HMR (hot module reload)

#### `src/App.tsx` (Router)
**Routes:**
- `/` → EditorPage (empty editor)
- `/s/:token` → EditorPage loaded with saved snippet

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<EditorPage />} />
    <Route path="/s/:token" element={<EditorPage />} />
  </Routes>
</BrowserRouter>
```

---

#### `src/types/index.ts` (Type Definitions)
```typescript
type Language = "go" | "python" | "cpp" | "rust" | "javascript"

// What frontend sends to /api/execute
ExecuteRequest {
  language: Language
  code: string
  stdin: string
}

// What backend responds with
ExecuteResponse {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  wasTimeout: boolean
}

// Saved snippet object
Snippet {
  token: string
  language: Language
  code: string
  stdin: string
  title: string
  createdAt: string
}
```

---

#### `src/pages/EditorPage.tsx` (Main Application)
**Purpose:** Main application state and layout

**Key State:**
```tsx
const [language, setLanguage] = useState<Language>("python")
const [code, setCode] = useState(defaultCode.python)
const [isRunning, setIsRunning] = useState(false)
const [libraryOpen, setLibraryOpen] = useState(false)
const [mobileTab, setMobileTab] = useState<MobileTab>("code" | "terminal")

const isMobile = useIsMobile(768)  // Is screen < 768px wide?
const wsRef = useRef<WebSocket | null>(null)  // WebSocket connection
```

**Default Code Per Language:**
```tsx
defaultCode = {
  python: `print("Hello, World!")`,
  javascript: `console.log("Hello, World!");`,
  go: `package main\nimport "fmt"\nfunc main() { fmt.Println("Hello, World!") }`,
  cpp: `#include <iostream>\nint main() { std::cout << "Hello, World!"; }`,
  rust: `fn main() { println!("Hello, World!"); }`,
}
```

**Key Functions:**

1. **`handleLanguageChange(lang: Language)`**
   - Change language
   - Reset code to default for new language

2. **`handleRun()`**
   - Validate code is not empty
   - Create WebSocket connection to `/api/execute/ws`
   - Send message: `{type: "start", language, code}`
   - Switch to terminal tab on mobile
   - Set `isRunning = true`

3. **Effect: Load snippet by token**
   ```tsx
   useEffect(() => {
     if (!token) return;
     loadSnippet(token)
       .then(snippet => {
         setLanguage(snippet.language)
         setCode(snippet.code)
       })
   }, [token])
   ```

**Layout:**
- Desktop: Split view (editor left, terminal right)
- Mobile: Tab view (code / terminal tabs)

---

#### `src/components/` (Reusable UI Components)

##### `Header.tsx`
- Logo + title
- Tagline: "Run code instantly in your browser"
- Security warning: "Do not paste secrets, API keys, or passwords"

##### `CodeEditor.tsx`
```tsx
interface CodeEditorProps {
  language: Language
  code: string
  onChange: (value: string) => void
}
```
- Uses Monaco Editor with vs-dark theme
- 14px JetBrains Mono font
- Bracket pair colorization
- Word wrap enabled
- Tab size: 4

##### `LanguageSelector.tsx`
- Dropdown with language options
- Shows icon, name, version
- Example: Python 3.12, Go 1.23, Node 22
- Keyboard support (ESC to close, arrow keys to navigate)

##### `InteractiveTerminal.tsx`
```tsx
interface InteractiveTerminalProps {
  isRunning: boolean
  wsRef: React.MutableRefObject<WebSocket | null>
}
```
- Displays program output line by line
- Shows exit code, duration, timeout status
- Input field to send stdin to program
- Auto-scrolls to latest output
- Color-coded output (green for stdout, red for stderr)

**WebSocket Message Handling:**
```tsx
case "output": setEntries([...prev, {type: "output", text: msg.data}])
case "stderr": setEntries([...prev, {type: "stderr", text: msg.data}])
case "exit": setExitInfo({exitCode: msg.exitCode, durationMs: msg.durationMs, wasTimeout: msg.wasTimeout})
case "error": setEntries([...prev, {type: "error", text: msg.message}])
```

##### `ShareButton.tsx`
- Creates snippet via `POST /api/snippets`
- Generates shareable link like `https://example.com/s/a3f7b2e1c9d8`
- Opens in new tab or copies to clipboard

##### `SnippetLibrary.tsx`
- Example code snippets for each language
- Shows description and code preview
- "Load" button to populate editor

##### `StdinPanel.tsx`
- Input area for program input
- Multiple lines supported
- Sends to `/api/execute` as `stdin` field

##### `OutputPanel.tsx`
- Shows execution result (not used with WebSocket)
- Displays stdout, stderr, exit code, duration

---

#### `src/utils/api.ts` (API Client)
```typescript
function getAPIBase(): string
  // Development (localhost): "http://localhost:8080/api"
  // Production: "/api"

async executeCode(req: ExecuteRequest): Promise<ExecuteResponse>
  // POST /api/execute
  // Used for one-time execution (synchronous HTTP)

async createSnippet(req: SnippetRequest): Promise<SnippetResponse>
  // POST /api/snippets {language, code, stdin, title}
  // Returns {token}

async loadSnippet(token: string): Promise<Snippet>
  // GET /api/snippets/{token}
  // Returns saved snippet

async checkHealth(): Promise<boolean>
  // GET /api/health
  // Returns true if backend is running
```

---

#### `src/utils/snippets.ts`
- Example code snippets for each language
- Provides quick-start templates

---

### Frontend Assets

#### `public/` (Static Files)
- `manifest.json` - PWA manifest (installable app)
- `sw.js` - Service worker (offline support)
- `icons/` - App icons
- `lang-icons/` - Language logos (Python, Go, C++, etc.)

#### `src/assets/`
- Images and icons

#### Styles
- `index.css` - Global styles
- `App.css` - App layout

---

### Frontend Testing

#### `src/test/`
- `setup.ts` - Test environment configuration
- `api.test.ts` - API client tests
- `Header.test.tsx` - Component tests
- `snippets.test.ts` - Snippet utilities tests

#### `e2e/`
- `codearena.spec.ts` - Playwright end-to-end tests

---

## Infrastructure (`infra/` Directory)

### Compiler Docker Images

Built from minimal base images, each creates a non-root `runner` user.

#### `infra/docker/python.Dockerfile`
```dockerfile
FROM python:3.12-slim
RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
```
- Python 3.12
- Non-root user `runner` for security
- Working directory `/home/runner`

#### `infra/docker/go.Dockerfile`
```dockerfile
FROM golang:1.23-bookworm
RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
```
- Go 1.23
- Bookworm (Debian 12) base

#### `infra/docker/cpp.Dockerfile`
```dockerfile
FROM gcc:latest
RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
```
- GCC 13+
- C++ compilation support

#### `infra/docker/rust.Dockerfile`
```dockerfile
FROM rust:latest
RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
```
- Rust 1.83+
- Cargo package manager included

#### `infra/docker/javascript.Dockerfile`
```dockerfile
FROM node:22-slim
RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
```
- Node.js 22
- Slim image (smaller, faster builds)

---

## Backend Build & Runtime

### `backend/Dockerfile` (Production Backend Image)
```dockerfile
# Multi-stage build
FROM golang:1.24-bookworm AS builder
  WORKDIR /build
  COPY go.mod go.sum ./
  RUN go mod download
  COPY . .
  RUN CGO_ENABLED=0 go build -o codearena .  # Static binary

FROM debian:bookworm-slim
  # Install CA certificates for HTTPS
  RUN apt-get update && apt-get install -y ca-certificates
  COPY --from=builder /build/codearena ./
  EXPOSE 8080
  CMD ["./codearena"]
```
- CGO_ENABLED=0: Statically linked (no C dependencies)
- Result: Single `codearena` binary
- ~10-20MB image size

---

## Frontend Build & Runtime

### `frontend/Dockerfile` (Production Frontend Image)
```dockerfile
# Build stage
FROM node:22-slim AS builder
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm ci
  COPY . .
  RUN npm run build  # Output in dist/

# Runtime stage
FROM nginx:alpine
  COPY --from=builder /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
```
- produces static HTML/JS/CSS files
- Served by Nginx on port 80
- Reverse proxy configured in `nginx.conf`

---

## Docker Compose Configuration

### `docker-compose.yml` (Development & Local Testing)

**Services:**

1. **docker-proxy**
   - Image: `alpine/socat`
   - Exposes Docker socket via TCP (port 2375)
   - Allows backend to reach Docker daemon

2. **compiler-images**
   - Image: `docker:cli`
   - **Runs once** on startup to build all 5 compiler images
   - Buildscript builds:
     - `codearena-python`
     - `codearena-go`
     - `codearena-cpp`
     - `codearena-rust`
     - `codearena-javascript`

3. **backend**
   - Builds from `./backend/Dockerfile`
   - Port: 8080
   - Depends on: `docker-proxy`, `compiler-images`
   - Environment: `DOCKER_HOST=tcp://docker-proxy:2375`

4. **frontend**
   - Builds from `./frontend/Dockerfile`
   - Port: 5173
   - Depends on: backend
   - Environment: `VITE_API_URL=http://backend:8080`

**Network:**
- All services on `codearena` network for inter-service communication

**Volumes:**
- `backend-data:/app/data` - Persists SQLite database

---

### `docker-compose.prod.yml` (Production with Traefik)
- Uses Traefik reverse proxy (TLS/HTTPS)
- Let's Encrypt auto-certificate
- Custom domain routing
- Rate limiting at proxy level

---

## Build System

### `Makefile` Build Targets

```makefile
make build-images
  # Builds all 5 Docker compiler images
  # Requires Docker to be running

make build-backend
  # Compiles Go backend → static binary

make build-frontend
  # Installs dependencies + builds React

make dev
  # Runs: backend + frontend with hot reload

make test
  # test-backend + test-frontend

make test-backend
  # go test ./... -v

make test-frontend
  # npm run test via vitest

make test-e2e
  # npm run e2e via playwright

make lint
  # eslint + prettier format check

make up/down
  # docker compose up/down

make clean
  # Remove build artifacts
```

---

## Key Workflows

### Workflow 1: User Writes & Runs Code (Synchronous)

```
1. User types code in Monaco Editor
2. Clicks "Run" button
3. Frontend makes POST to /api/execute with {language, code, stdin}
4. Backend Handler executeHandler():
   - Validates request
   - Calls exec.Run() with code
   - Executor creates Docker container
   - Waits up to 10 seconds for completion
   - Captures stdout, stderr, exit code
   - Container auto-removed
5. Backend returns JSON result
6. Frontend displays output in OutputPanel
```

### Workflow 2: User Runs Interactive Code (WebSocket)

```
1. User clicks "Run" in editor (same button)
2. Frontend creates WebSocket to /api/execute/ws
3. Sends first message: {type: "start", language, code}
4. Backend wsExecuteHandler():
   - Upgrades HTTP to WebSocket
   - Calls exec.RunInteractive()
   - Creates container with PTY
   - Container starts, output streamed
5. Container outputs lines → sent as {type: "output", data: "..."}
6. Frontend receives messages & displays in InteractiveTerminal
7. User types in terminal input → sent as {type: "input", data: "..."}
8. Backend forwards input to container via stdin
9. Container finishes:
   - Sends {type: "exit", exitCode, durationMs, wasTimeout}
   - WebSocket closes
10. Frontend shows exit info
```

### Workflow 3: Share Snippet

```
1. User clicks "Share" button
2. Frontend sends POST to /api/snippets with {language, code, stdin, title}
3. Backend snippetsHandler():
   - Validates fields
   - Store.Create() generates random token
   - Saves to SQLite
   - Returns {token}
4. Frontend generates URL: https://example.com/s/{token}
5. User shares link
6. Someone opens link
7. Frontend loads with param /s/{token}
8. EditorPage calls loadSnippet(token)
9. Backend GET /api/snippets/{token} returns snippet
10. Frontend populates editor with loaded code
```

### Workflow 4: Rate Limiting

```
User IP makes requests:
1st req → 15 tokens available, use 1 → 14 left, ALLOW
2nd req → 14 tokens left, use 1 → 13 left, ALLOW
...
15th req → 1 token left, use 1 → 0 left, ALLOW
16th req → 0 tokens left, DENY (HTTP 429)

After 200ms (5 tokens/sec refill):
17th req → 1 token added → 1 token available, use 1 → 0 left, ALLOW
```

---

## Security & Resource Limits

**Container Isolation Measures:**
```go
NetworkDisabled: true       // No network access
User: "runner"              // Non-root user
Memory: 256 * 1024 * 1024   // 256MB max
NanoCPUs: 1e9               // 1 CPU core
PidsLimit: 256              // Max processes
Timeout: 10 seconds         // Kill if running too long
```

**API Security:**
- Rate limiting: 5 req/sec per IP
- Max request size: 5MB
- Max output captured: 64KB
- CORS: Limited to frontend origin
- No secrets stored (SQLite local DB)

---

## Development Commands

### Start Development

```bash
# Terminal 1: Backend
cd backend
go run .
# Runs on http://localhost:8080

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173

# Terminal 3: Build Docker images
make build-images
```

### Testing

```bash
# Backend tests
cd backend && go test ./... -v

# Frontend unit tests
cd frontend && npm run test

# Frontend E2E tests
cd frontend && npm run test:e2e

# All tests
make test
```

### Building for Production

```bash
# Full build: backend + frontend + Docker images
make all

# Or Docker Compose
docker compose up --build

# Production deployment
export DOMAIN=codearena.example.com
export ACME_EMAIL=admin@example.com
docker compose -f docker-compose.prod.yml up -d
```

---

## File-by-File Quick Reference

| Path | Purpose |
|------|---------|
| **backend/main.go** | HTTP server, route handlers, request validation |
| **backend/executor/executor.go** | Docker container execution, resource limits |
| **backend/executor/interactive.go** | WebSocket streaming, TTY support |
| **backend/store/store.go** | SQLite snippet persistence |
| **backend/ratelimit/ratelimit.go** | IP-based rate limiting |
| **frontend/src/App.tsx** | Router, page navigation |
| **frontend/src/pages/EditorPage.tsx** | Main app state, layout, language logic |
| **frontend/src/components/CodeEditor.tsx** | Monaco editor wrapper |
| **frontend/src/components/InteractiveTerminal.tsx** | WebSocket output display |
| **frontend/src/components/LanguageSelector.tsx** | Language picker dropdown |
| **frontend/src/components/Header.tsx** | App header |
| **frontend/src/utils/api.ts** | HTTP/WebSocket client functions |
| **infra/docker/*.Dockerfile** | Compiler environment images |
| **backend/Dockerfile** | Production backend image |
| **frontend/Dockerfile** | Production frontend image |
| **docker-compose.yml** | Local dev environment |
| **Makefile** | Build automation |

---

## How to Add a New Language

Let's say you want to add **Ruby** support:

### 1. Create Docker image
```dockerfile
# infra/docker/ruby.Dockerfile
FROM ruby:3.3-alpine
RUN addgroup -S runner && adduser -S runner -G runner
USER runner
WORKDIR /home/runner
```

### 2. Update backend/executor/executor.go
```go
const LangRuby Language = "ruby"

// In imageMap
var imageMap = map[Language]string{
    ...
    LangRuby: "codearena-ruby",
}

// In executeHandler validation
if lang != ... && lang != executor.LangRuby ...
```

### 3. Update buildCommand() in executor.go
```go
case LangRuby:
    return []string{"ruby", "-x", "-"}
```

### 4. Update frontend types
```typescript
// frontend/src/types/index.ts
export type Language = "go" | "python" | "cpp" | "rust" | "javascript" | "ruby"
```

### 5. Update LanguageSelector
```tsx
{ value: "ruby", label: "Ruby", icon: "/lang-icons/ruby.png", desc: "3.3", color: "#CC342D" }
```

### 6. Add default code
```tsx
defaultCode["ruby"] = `puts "Hello, World!"`
```

### 7. Build and test
```bash
make build-images
cd backend && go run .
cd frontend && npm run dev
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker daemon not running | Start Docker desktop or `dockerd` |
| Port 8080 already in use | Change backend port in docker-compose.yml |
| Frontend can't reach backend | Check `getAPIBase()` in utils/api.ts |
| Rate limit exceeded | Wait a few seconds or clear visitor state |
| WebSocket connection fails | Check reverse proxy CORS headers |
| Snippet not found | Token may have expired or doesn't exist |

---

## Performance Notes

- **Execution startup:** ~500-1000ms (Docker container creation)
- **Typical execution:** 1-5 seconds (code runtime)
- **Output limit:** 64KB (prevents huge responses)
- **Memory limit:** 256MB (prevents runaway resource usage)
- **Frontend bundle size:** ~500KB gzipped
- **Backend binary size:** ~10-20MB

---

## License

MIT License - See [LICENSE](LICENSE) file
