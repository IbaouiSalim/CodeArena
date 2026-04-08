# Installation & Operations Guide

**Implemented by:** Mohamed Salim Ibaoui  
**Email:** ibaouisalim@gmail.com  
**Repository:** https://git.fh-aachen.de/codearenaproject/codearena.git

## Quick Start

Clone and build:
```bash
git clone https://git.fh-aachen.de/codearenaproject/codearena.git
cd codearena
make build-images
```

Terminal 1 - Backend:
```bash
cd backend
go run .
```

Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in browser.

## Development Setup

Prerequisites: Go 1.21+, Node.js 22+, Docker, Git

Backend runs on http://localhost:8080
Frontend runs on http://localhost:5173

## Production Setup

> **Note:** This section is for deploying to a production server. For local development, see Quick Start above.

Server requirements: Ubuntu 22.04+, 4GB RAM, 20GB disk, ports 80/443

Install Docker and Docker Compose. Configure firewall:
```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Clone and deploy:
```bash
sudo git clone https://git.fh-aachen.de/codearenaproject/codearena.git /opt/codearena
cd /opt/codearena

# Set environment variables
export DOMAIN=your-domain.com
export ACME_EMAIL=your-email@example.com

# Deploy with Traefik (for automatic TLS)
docker compose -f docker-compose.prod.yml up -d
```

## Operations

View logs:
```bash
docker compose logs -f backend
```

Restart services:
```bash
docker compose restart
```

Update and redeploy:
```bash
git pull origin main
docker compose up --build -d
```

Database backup:
```bash
docker compose exec backend cp /app/data/codearena.db /app/data/codearena.db.backup
docker cp $(docker compose ps -q backend):/app/data/codearena.db.backup ./
```

Database restore:
```bash
docker cp ./codearena.db.backup $(docker compose ps -q backend):/app/data/
docker compose exec backend cp /app/data/codearena.db.backup /app/data/codearena.db
docker compose restart backend
```

## Troubleshooting

Cannot connect to Docker: `docker compose restart backend`

High memory: Adjust MemoryMB in backend/executor/executor.go

Unable to save snippets: Check /app/data/codearena.db permissions

WebSocket fails: Check firewall and CORS settings

Compiler images not found: `docker compose up --build -d`
