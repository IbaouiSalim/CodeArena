# CodeArena – System Architecture (Draft)

## 1. High-Level Overview

CodeArena consists of four main components:

1. Frontend (React + Monaco Editor)
2. Backend (Go REST API)
3. Execution Layer (Docker containers per run)
4. Database (PostgreSQL or SQLite)

---

## 2. Component Flow

User → Frontend → Backend → Docker Container → Backend → Frontend → User

### Detailed Flow

1. User writes code in Monaco Editor.
2. Frontend sends POST /api/execute to backend.
3. Backend:
   - Selects Docker image based on language
   - Starts container
   - Applies resource limits
   - Captures stdout/stderr
   - Stops and removes container
4. Backend sends JSON response.
5. Frontend displays output.

---

## 3. Container Strategy

- One Docker image per language:
  - Go image
  - Python image
  - C++ image
- Each execution:
  - Runs in new container
  - No network access
  - No volume mounts
  - Non-root user

---

## 4. Database Usage

Database stores:
- Snippet code
- Language
- Stdin
- Title
- Creation timestamp
- Share token

---

## 5. Reverse Proxy

Traefik (preferred) or Nginx will:
- Handle HTTPS (Let's Encrypt)
- Forward traffic to backend
- Apply rate limiting

---

## 6. Deployment Overview

Production server:
- Ubuntu 22.04
- Docker Engine
- Docker Compose
- Reverse Proxy
- Firewall (ufw)

