# Developer Handbook

**Implemented by:** Mohamed Salim Ibaoui (ibaouisalim@gmail.com)  
**Specification:** Prof. Dr. Jörg Striegnitz, FH-Aachen  
**Completion:** April 2026

## Architecture

Browser (React + Monaco Editor + TypeScript on Vite) connects to Go Backend on port 8080 via HTTP/WebSocket.

Backend handles:
- Code execution orchestration
- Rate limiting (5 requests/second)
- Snippet storage (SQLite)
- REST and WebSocket APIs

Docker Engine runs isolated containers for each code execution:
- codearena-python
- codearena-go
- codearena-cpp
- codearena-rust
- codearena-javascript

## Project Structure

backend/
  main.go - Entry point
  executor/ - Container orchestration
  ratelimit/ - Rate limiting
  store/ - Database

frontend/
  src/ - React components
  e2e/ - Playwright tests
  utils/ - API calls

infra/
  docker/ - Compiler images

## Backend

main.go: HTTP server on port 8080, registers handlers

executor/executor.go: Execute() runs code in container, enforces limits

executor/interactive.go: RunInteractive() streams output via WebSocket

ratelimit/ratelimit.go: Token bucket rate limiter

store/store.go: SQLite persistence for snippets

## Frontend

App.tsx: Main component

components/ - CodeEditor, OutputPanel, LanguageSelector, etc

pages/EditorPage.tsx: Main editor page

utils/api.ts: HTTP/WebSocket calls to backend

test/ - Vitest unit tests

e2e/ - Playwright integration tests

## Development

Backend: `cd backend && go run .`

Frontend: `cd frontend && npm install && npm run dev`

Run unit tests:
- Go: `cd backend && go test ./...`
- TypeScript: `cd frontend && npm test`

Run E2E tests: `cd frontend && npm run test:e2e`

## Key Files

Backend execution logic: backend/executor/executor.go
Frontend API calls: frontend/src/utils/api.ts
Container security: Dockerfile files in infra/docker/
Database schema: backend/store/store.go

