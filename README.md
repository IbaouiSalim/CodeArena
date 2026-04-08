# CodeArena

Run code snippets in Docker containers from your browser.

Supports Go, Python, C++, Rust, and JavaScript.

**Implemented by:** Mohamed Salim Ibaoui  
**Contact:** ibaouisalim@gmail.com  
**Repository:** https://git.fh-aachen.de/codearenaproject/codearena.git

## What it does

- Edit code in the browser
- Execute code in Docker containers
- See the output
- Share code with links
- Works as an offline web app

## Documentation

- [INSTALLATION_GUIDE.md](docs/INSTALLATION_GUIDE.md) - how to set it up
- [SECURITY.md](docs/SECURITY.md) - security information
- [DEVELOPER_HANDBOOK.md](docs/DEVELOPER_HANDBOOK.md) - how it works
- [api.md](docs/api.md) - API endpoints

## Quick start

### Local development

Terminal 1 - start the backend:
```
make build-images
cd backend && go run .
```

Terminal 2 - start the frontend:
```
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173

### Docker Compose

```
docker compose up --build
```

### Production Deployment

To deploy to a production server, set environment variables:
```bash
export DOMAIN=your-domain.com
export ACME_EMAIL=your-email@example.com
docker compose -f docker-compose.prod.yml up -d
```

Then access at `https://your-domain.com`

## Technology

- Frontend: React, TypeScript, Vite, Monaco Editor
- Backend: Go 1.23
- Database: SQLite
- Containers: Docker and Docker Compose
- Reverse proxy: Traefik with TLS
- Testing: Go tests, Vitest, Playwright

## Security

- Each code execution runs in its own Docker container
- Containers get CPU and memory limits
- Network access is disabled
- Code runs as a non-root user
- Timeouts prevent infinite loops

See [SECURITY.md](docs/SECURITY.md) for details.

## Testing

```
make test-backend
make test-frontend
make test-e2e
make test
```

## License

MIT License - See LICENSE file for details

## Credits

Developed as part of the CodeArena project (Prof. Dr. Jörg Striegnitz, FH-Aachen)  
Implemented by: Mohamed Salim Ibaoui (2026)
