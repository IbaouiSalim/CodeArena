Installation and Operations Guide

Local Development:

Clone Repository
Linux/Mac: git clone https://git.fh-aachen.de/codearenaproject/codearena.git && cd codearena && make build-images
Windows (PowerShell): git clone https://git.fh-aachen.de/codearenaproject/codearena.git; cd codearena; make build-images
Requirements: Go 1.21+, Node.js 22+, Docker Desktop

Start Backend
Linux/Mac: cd backend && go run .
Windows: cd backend; go run .
Output: CodeArena backend running on http://localhost:8080

Start Frontend (New Terminal)
Linux/Mac: cd frontend && npm install && npm run dev
Windows: cd frontend; npm install; npm run dev
Output: Local: http://localhost:5173 (or next available port)

Access Application
Open browser to: http://localhost:5173
Frontend: http://localhost:5173
Backend: http://localhost:8080

Docker Compose (Full Stack):

Linux/Mac:
docker compose up --build -d
docker compose ps
docker compose logs -f backend
docker compose down

Windows:
docker compose up --build -d
docker compose ps
docker compose logs -f backend
docker compose down

Verify services running:
Frontend: http://localhost:5173
Backend: http://localhost:8080

Production Setup:

Prerequisites:
Ubuntu 22.04 LTS or Debian-based server
Domain name pointing to server IP
SSH access
Docker + Docker Compose installed

Server Firewall (Ubuntu):
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status

Deploy to Production:
On your server:
sudo mkdir -p /opt/codearena
cd /opt/codearena
sudo git clone https://git.fh-aachen.de/codearenaproject/codearena.git .
sudo chown -R $USER:$USER /opt/codearena

Create .env file:
DOMAIN=your-domain.com
ACME_EMAIL=your-email@example.com

docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps

Services:
HTTP: http://your-domain.com (redirects to HTTPS)
HTTPS: https://your-domain.com
Dashboard: https://your-domain.com/dashboard (Traefik)

Operations Commands:

Check Status:
Linux/Mac: docker compose ps
Windows: docker compose ps

View Logs:
Linux/Mac: docker compose logs backend
Windows: docker compose logs backend

Restart Services:
All platforms: docker compose restart

Update Code:
Linux/Mac: cd /opt/codearena && git pull origin main && docker compose -f docker-compose.prod.yml up --build -d
Windows: cd /path/to/codearena; git pull origin main; docker compose -f docker-compose.prod.yml up --build -d

Backup Database:
Linux/Mac: docker exec codearena-main-backend-1 cp /app/data/codearena.db /app/data/codearena-backup.db && docker cp codearena-main-backend-1:/app/data/codearena-backup.db ./
Windows: docker exec codearena-main-backend-1 cp /app/data/codearena.db /app/data/codearena-backup.db; docker cp codearena-main-backend-1:/app/data/codearena-backup.db ./

Configuration:

Environment Variables:
Create .env file in project root with:
DOMAIN=codearena.example.com
ACME_EMAIL=admin@example.com
CORS_ORIGIN=https://your-domain.com
CODEARENA_DB_PATH=/app/data/codearena.db

DOMAIN: Required for production
ACME_EMAIL: Required for Let's Encrypt certificates
CORS_ORIGIN: Optional CORS allowed origin
CODEARENA_DB_PATH: Optional database path

Ports:

Local Development:
8080 - Backend API
5173 - Frontend (or next available)

Production:
80 - HTTP (auto-redirects to HTTPS)
443 - HTTPS (auto-provisioned via Let's Encrypt)
22 - SSH (admin only)
