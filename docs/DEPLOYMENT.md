CodeArena Production Deployment Guide

This guide covers deploying CodeArena to a production Ubuntu server with Traefik reverse proxy, automatic TLS via Let's Encrypt, and firewall security.

Prerequisites:
Ubuntu 22.04 LTS or Debian-based system
Domain name pointing to server IP
SSH access to server
Docker and Docker Compose installed

1. GitHub Actions CI/CD Pipeline

Pipeline Overview:
The CI/CD pipeline (.github/workflows/deploy.yml) runs automatically on:
Triggers: Push to main branch or pull requests
Jobs:
- test-backend: Go unit tests + coverage
- test-frontend: TypeScript lint, format check, Vitest + coverage
- e2e-tests: Playwright browser tests
- build: Build Docker images (runs only after tests pass)
- deploy: SSH to VPS and pull latest code (only on main branch push)

Required GitHub Secrets:
Set these in GitHub repository settings (Settings → Secrets and variables → Actions):
VPS_HOST: your.server.com (or IP address)
VPS_USER: deploy (SSH user)
VPS_SSH_KEY: SSH private key content

Generate SSH Key for CI/CD:
ssh-keygen -t ed25519 -f deploy_key -N ""
cat deploy_key.pub >> ~/.ssh/authorized_keys
cat deploy_key (copy to GitHub Secrets as VPS_SSH_KEY)

Deployment Flow:
Push to main
Backend tests pass
Frontend tests pass
E2E tests pass
Build Docker images
SSH deploy to VPS
git pull origin main
docker compose -f docker-compose.prod.yml up --build -d

2. Firewall Configuration (ufw)

Server Setup:
sudo apt-get update
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 22/udp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status numbered

Verify Firewall Rules:
sudo ss -tulpn | grep LISTEN
Should see ports 22, 80, 443 listening

Important Security Notes:
Before enabling firewall on SSH: Always allow port 22 first
sudo ufw allow 22/tcp
sudo ufw enable

Docker-based services: UFW rules apply to container traffic

DO NOT expose: Database ports, Docker socket, internal APIs

3. TLS/Let's Encrypt with Traefik

Production Environment Setup:
Create .env.prod file on server:
DOMAIN=codearena.example.com
ACME_EMAIL=admin@example.com

Deployment Steps:
ssh deploy@your.server.com
sudo mkdir -p /opt/codearena
cd /opt/codearena
sudo git clone https://github.com/yourname/codearena.git .
sudo chown -R $USER:$USER /opt/codearena

Create production environment file:
DOMAIN=codearena.example.com
ACME_EMAIL=admin@example.com

docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs traefik | head -20

Traefik TLS Configuration:
The docker-compose.prod.yml includes:
Let's Encrypt ACME challenges via HTTP-01: true
ACME email: ${ACME_EMAIL}
Certificate storage: /letsencrypt/acme.json
Auto-redirect HTTP to HTTPS: enabled
Persistent certificate storage: letsencrypt volume

Monitoring Certificate Provisioning:
docker compose -f docker-compose.prod.yml logs -f traefik
Certificate should be requested within 30 seconds
Look for: "Certificate obtained successfully"

Verify certificate file:
docker exec codearena-main-traefik-1 ls -la /letsencrypt/acme.json
docker exec codearena-main-traefik-1 cat /letsencrypt/acme.json

Certificate Renewal:
Let's Encrypt certificates expire every 90 days. Traefik automatically:
Monitors certificate expiration
Requests renewal 30 days before expiration
Validates challenges with Let's Encrypt
Reloads updated certificate

No manual action required.

Certificate Validation:
curl -I https://codearena.example.com
Should show: HTTP/1.1 200 OK with Strict-Transport-Security header

openssl s_client -connect codearena.example.com:443 -servername codearena.example.com

Troubleshooting:

Certificate not provisioned:
docker compose -f docker-compose.prod.yml logs traefik | grep -i "challenge\|error\|acme"
Common issues: Domain not pointing to server IP, Port 80 not open, Email typo

ACME error presenting validation:
curl http://codearena.example.com/.well-known/acme-challenge/test
If blocked, check firewall: sudo ufw status

Backend/Frontend not accessible over HTTPS:
docker compose -f docker-compose.prod.yml logs traefik | grep "backend\|frontend"
docker compose -f docker-compose.prod.yml restart

4. Testing Production Deployment Locally

Mock Production with Docker Compose:
export DOMAIN=localhost
export ACME_EMAIL=test@example.com
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps

Full deployment checklist:
Domain registered and points to server IP
SSH keys configured in GitHub Secrets
UFW firewall configured (ports 22, 80, 443 open)
Docker/Docker Compose installed on VPS
/opt/codearena directory exists
.env.prod file with DOMAIN and ACME_EMAIL set
First deployment successful
HTTPS certificate provisioned (check in browser)
Rate limiting working (test with multiple requests)
All services running

5. Maintenance & Monitoring

Monitor running services:
ssh deploy@your.server.com
cd /opt/codearena
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
du -sh backend-data/

Update CodeArena:
git pull origin main
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs traefik | head -5

Backup snippets database:
Backup: docker cp codearena-main-backend-1:/app/data/codearena.db ./codearena-backup-DATE.db
Restore: docker cp ./codearena-backup-DATE.db codearena-main-backend-1:/app/data/codearena.db

Security Checklist:
Firewall restricts traffic to SSH (22), HTTP (80), HTTPS (443)
Container runs as non-root user (runner)
Process isolation: each execution runs in separate container
Network isolation: containers have network: none
Resource limits: max 256MB memory, 1 CPU, 10 second timeout
Rate limiting: 5 req/sec per IP
No persistent filesystem access
TLS certificates auto-renewed by Let's Encrypt
GitHub Actions deploy secrets encrypted

Support:
Documentation: See docs/ directory
Issues: Report on GitHub
Contact: Check README for contact info
