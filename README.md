# CodeArena

Run code snippets in Docker containers from your browser.

Supports Go, Python, C++, Rust, and JavaScript.

## Features

- Edit code in browser with Monaco Editor
- Execute code in isolated Docker containers
- View output and errors
- Share code with shareable links
- Works as offline web app (PWA)
- Interactive terminal with stdin/stdout

## Documentation

[INSTALLATION_GUIDE.md](docs/INSTALLATION_GUIDE.md) - Setup and operations
[SECURITY.md](docs/SECURITY.md) - Security design
[DEVELOPER_HANDBOOK.md](docs/DEVELOPER_HANDBOOK.md) - Architecture and development

## Quick Start

Local development (Terminal 1):
```bash
make build-images
cd backend && go run .
```

Local development (Terminal 2):
```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

Or use Docker Compose:
```bash
docker compose up --build
```

Production:
```bash
export DOMAIN=your-domain.com
export ACME_EMAIL=your-email@example.com
docker compose -f docker-compose.prod.yml up -d
```

## Stack

Frontend: React 19.2, TypeScript 5.9, Vite, Monaco Editor
Backend: Go 1.24, Docker SDK
Database: SQLite
Proxy: Traefik v3.0 with Let's Encrypt
Testing: Go tests, Vitest, Playwright E2E

## Security

Each execution runs in isolated Docker containers with:
- CPU and memory limits (1 core, 256MB)
- 10 second timeout
- Network disabled
- Non-root user
- No access to host system

See [SECURITY.md](docs/SECURITY.md)

## Testing

```bash
make test
make test-backend
make test-frontend
make test-e2e
```

All 44 tests passing.

## License

MIT License
