# CodeArena

Run code snippets in Docker containers through your browser. Supports Go, Python, C++, Rust, JavaScript.

## Documentation

- [Installation & Operations Guide](docs/INSTALLATION_GUIDE.md) - Setup and operations
- [Security Documentation](docs/SECURITY.md) - How isolation and limits work
- [Developer Handbook](docs/DEVELOPER_HANDBOOK.md) - Architecture and contributing
- [API Reference](docs/api.md) - Endpoint documentation
- [Requirements](docs/requirements.md) - Project specifications

## Quick Start (Local)

```bash
make build-images
cd backend && go run .
```

In another terminal:

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Docker Compose

```bash
docker compose up --build
```

## Production

```bash
export DOMAIN=codearena.example.com
export ACME_EMAIL=admin@example.com
docker compose -f docker-compose.prod.yml up -d
```
