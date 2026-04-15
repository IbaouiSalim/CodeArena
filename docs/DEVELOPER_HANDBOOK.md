Developer Handbook

Architecture:
Frontend: React 19.2 + TypeScript 5.9 + Monaco Editor on Vite
Backend: Go 1.24 with Docker SDK
Communication: HTTP and WebSocket on port 8080

Backend handles code execution, rate limiting (5 req/sec), and snippet storage (SQLite).
Frontend handles editing, compilation output, and interactive terminal.

Execution environments:
Python 3.12, Go 1.23, C++ (gcc-13), Rust (latest), JavaScript (Node.js 22)

Project Structure:

backend/
  main.go - HTTP server on :8080
  executor/executor.go - Container orchestration and execution
  executor/interactive.go - WebSocket streaming
  ratelimit/ratelimit.go - Rate limiting
  store/store.go - SQLite database

frontend/
  src/ - React components, TypeScript
  components/ - Reusable UI components
  utils/api.ts - Backend API calls
  pages/EditorPage.tsx - Main editor page
  test/ - Vitest unit tests
  e2e/ - Playwright tests

Backend:
main.go - Server initialization and route handlers
Execute() - Runs code in isolated container
RunInteractive() - Streams output over WebSocket
Rate limiter - Token bucket (5 req/sec, 15 burst)
Database - SQLite with snippet storage

Frontend:
App.tsx - Main application
CodeEditor - Monaco editor with language detection
OutputPanel - Displays execution results
InteractiveTerminal - WebSocket-based I/O
LanguageSelector - Language picker with icons

Development:
Start backend: cd backend && go run .
Start frontend: cd frontend && npm install && npm run dev
Run backend tests: cd backend && go test ./...
Run frontend tests: cd frontend && npm test
Run E2E tests: cd frontend && npm run test:e2e

Key Code Paths:
Execution: backend/executor/executor.go - Execute()
WebSocket: backend/executor/interactive.go - RunInteractive()
API: frontend/src/utils/api.ts - executeCode()
Database: backend/store/store.go - SaveSnippet(), LoadSnippet()
Docker images: infra/docker/

