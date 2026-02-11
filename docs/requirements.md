# CodeArena – Requirements Specification (WP-1)

## 1. Scope
CodeArena is a Progressive Web App (PWA) that executes user-provided code snippets in isolated containers and displays the results in the browser. Supported languages: Go, Python, C++

### Out of Scope (for this project phase)
- User accounts / authentication
- Private snippets (sharing is public)
- Horizontal scaling / job queue (possible later)

## 2. Functional Requirements (Must)

### F1 – Code Editor
- Monaco Editor with syntax highlighting for all supported languages
- Line numbers

**Acceptance:** Editor loads, language changes update highlighting

### F2 – Language Selection
- Users can choose at least: Go and Python
- C++ is included as a required supported language (see supported languages table)

**Acceptance:** UI allows switching among supported languages

### F3 – Code Execution
- Code is compiled/executed in an isolated container
- System returns stdout, stderr, and exit code

**Acceptance:** A “Hello World” snippet works for each language and returns correct stdout

### F4 – Resource Limits
- Timeout: max 10 seconds
- Memory limit: max 256 MB
- CPU limit: 1 core
- Network disabled inside execution container

**Acceptance:** Infinite loop times out; memory hog fails; network access is blocked

### F5 – stdin Support
- User can provide stdin content for the program

**Acceptance:** A snippet that reads from stdin produces expected output

### F6 – Sharing Links
- Create a short link for a snippet
- Anyone with the link can view/run the snippet

**Acceptance:** Share link loads the saved snippet

### F7 – Snippet Library
- Provide predefined example snippets per language (e.g., Hello World, Sorting)

**Acceptance:** Library displays examples and loads them into the editor

### F8 – Responsive Design
- Usable on desktop and tablet

**Acceptance:** Layout works at common tablet widths without breaking

## 3. Optional / Bonus Requirements
- O1: Add Rust or JavaScript as 4th language
- O2: Comparison mode (same algorithm in multiple languages)
- O3: Execution history (session-based)
- O4: Compiler options (C++ standard, optimization level)

## 4. Non-Functional Requirements

### NF1 – PWA
- Manifest + Service Worker
- Installable (Add-to-Home-Screen)

### NF2 – TypeScript Quality
- Strict typing
- ESLint + Prettier

### NF3 – Go Backend
- REST API using Go standard library (net/http)
- Synchronous execution flow

### NF4 – Container Isolation
- Each execution in its own container
- No persistent container filesystem
- Network disabled

### NF5 – Security
- Limits strictly enforced
- No root inside container
- Firewall configured on server
- Output size is limited to prevent log-based DoS

### NF6 – Performance
- Hello World compile+run < 5 seconds

### NF7 – Reverse Proxy + TLS
- Traefik (preferred) or Nginx
- TLS via Let’s Encrypt

### NF8 – Testing
- Go unit tests
- Vitest for frontend
- At least one Playwright E2E test

### NF9 – Documentation
- README
- Install/operations guide
- Security concept
- Developer handbook (max 5 pages)

## 5. Acceptance Test Summary
Minimum acceptance tests for MVP:
- Run Hello World in Go/Python/C++
- Block networking in container
- Enforce timeout and memory limits
- Share link persists and reloads a snippet
