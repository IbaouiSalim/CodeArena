# Installation & Operations Guide

## Contents
1. [Development Setup](#development-setup)
2. [Production Setup](#production-setup)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Operations](#operations)
5. [Troubleshooting](#troubleshooting)

## Development Setup

### Prerequisites
- Go 1.21+
- Node.js 22+
- Docker and Docker Compose
- Git

### Steps

1. Clone repository:
```bash
git clone https://github.com/yourusername/codearena.git
cd codearena
```

2. Build compiler images:
```bash
make build-images
```

3. Start backend (Terminal 1):
```bash
cd backend
go run .
```

Backend runs on http://localhost:8080

4. Start frontend (Terminal 2):
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

5. Open http://localhost:5173 in browser

## Production Setup

### Server Requirements
- Ubuntu 22.04+ LTS
- 4GB+ RAM (8GB recommended)
- 20GB disk space
- 2+ CPU cores
- Ports 80, 443 open

### Installation

1. Install Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

2. Install Docker Compose:
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. Configure firewall:
```bash
sudo apt update && apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

4. Clone code:
```bash
git clone https://github.com/yourusername/codearena.git /opt/codearena
cd /opt/codearena
```

## Docker Compose Deployment

1. Create .env file:
```bash
DOMAIN=codearena.example.com
ACME_EMAIL=admin@example.com
```

2. Deploy:
```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml ps
```

3. Verify:
```bash
curl https://codearena.example.com/api/health
```

Expected response: `{"status":"ok"}`

## Operations

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Restart services
```bash
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml restart backend
```

### Update and redeploy
```bash
cd /opt/codearena
git pull origin main
docker compose -f docker-compose.prod.yml up --build -d
```

### Database backup
```bash
docker compose -f docker-compose.prod.yml exec backend cp /app/data/codearena.db /app/data/codearena.db.backup
docker cp $(docker compose -f docker-compose.prod.yml ps -q backend):/app/data/codearena.db.backup ./codearena.db.backup
```

### Database restore
```bash
docker cp ./codearena.db.backup $(docker compose -f docker-compose.prod.yml ps -q backend):/app/data/
docker compose -f docker-compose.prod.yml exec backend cp /app/data/codearena.db.backup /app/data/codearena.db
docker compose -f docker-compose.prod.yml restart backend
```

### SSL/TLS certificate renewal
```bash
# Check status
docker compose -f docker-compose.prod.yml logs traefik | grep certificate

# Force renewal if needed
docker compose -f docker-compose.prod.yml exec traefik rm /letsencrypt/acme.json
docker compose -f docker-compose.prod.yml restart traefik
```

## Troubleshooting

### Backend: Cannot connect to Docker daemon
```bash
docker compose -f docker-compose.prod.yml restart backend
ls -la /var/run/docker.sock
docker compose -f docker-compose.prod.yml ps
```

### High memory usage
Check limits in `backend/executor/executor.go`:
- MemoryMB: 256 (can be increased if needed)
- Timeout: 10s

### Rate limiting (429 errors)
Adjust in `docker-compose.prod.yml`:
```yaml
- "traefik.http.middlewares.api-ratelimit.ratelimit.average=10"
- "traefik.http.middlewares.api-ratelimit.ratelimit.burst=30"
```

Also update `backend/ratelimit/ratelimit.go`:
```go
limiter = ratelimit.New(10, 30)
```

### WebSocket connection fails
```bash
docker compose -f docker-compose.prod.yml logs backend | grep CORS
sudo ufw status
```

### Snippets not saving
```bash
docker compose -f docker-compose.prod.yml exec backend sh
ls -la /app/data/codearena.db
chmod 666 /app/data/codearena.db
exit
docker compose -f docker-compose.prod.yml restart backend
```

### Compiler images not found
```bash
docker compose -f docker-compose.prod.yml up --build -d compiler-images
docker compose -f docker-compose.prod.yml logs -f compiler-images
docker images | grep codearena
```

## Performance

Memory usage:
- Backend: ~100MB base
- Per execution: ~50MB
- Frontend: ~30MB

Concurrent limit: 256 PIDs per container (fork bomb protection)

Scaling:
- Use PostgreSQL instead of SQLite for larger deployments
- Add indexing on token column in database
- Run multiple backend instances with load balancer for more concurrent users
