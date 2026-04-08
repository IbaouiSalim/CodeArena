# Deployment

## Prerequisites

Ubuntu 22.04+ server with public IP, domain name, Docker, Docker Compose.

## Setup VPS

```bash
# SSH into VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /opt/codearena
cd /opt/codearena
git clone https://git.fh-aachen.de/codearenaproject/codearena.git .
```

## Configure Firewall

```bash
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Setup Deployment

Create `.env.production` on VPS:
```bash
DOMAIN=codearena.example.com
ACME_EMAIL=admin@example.com
```

## Deploy with Docker Compose

```bash
cd /opt/codearena
docker compose -f docker-compose.prod.yml up -d
```

Traefik automatically handles HTTPS with Let's Encrypt.

## Verify Deployment

```bash
# Check containers
docker compose -f docker-compose.prod.yml ps

# Check certificate
docker compose -f docker-compose.prod.yml logs traefik | grep ACME

# Test HTTPS
curl -I https://codearena.example.com/
```

## Operations

View logs:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Restart:
```bash
docker compose -f docker-compose.prod.yml restart
```

Update:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up --build -d
```

## Rollback

```bash
git checkout HEAD~1
docker compose -f docker-compose.prod.yml up --build -d
```

## Troubleshooting

Check Traefik for certificate issues:
```bash
docker compose -f docker-compose.prod.yml logs traefik
```

Restart backend if code cannot connect to Docker:
```bash
docker compose -f docker-compose.prod.yml restart backend
```

## Prerequisites

- Ubuntu 22.04 LTS (or Debian-based) server with public IP
- Domain name pointing to your server
- Docker and Docker Compose installed on the VPS
- GitHub repository with push access
- SSH key pair for VPS authentication

## Step 1: Prepare VPS Server

### Install Docker & Docker Compose

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Create Application Directory

```bash
mkdir -p /opt/codearena
cd /opt/codearena
git clone https://git.fh-aachen.de/codearenaproject/codearena.git .
```

## Step 2: Configure Firewall

Setup UFW to only allow necessary ports:

```bash
# Enable UFW
ufw enable

# Allow SSH (port 22)
ufw allow 22/tcp

# Allow HTTP (port 80) for Let's Encrypt challenge
ufw allow 80/tcp

# Allow HTTPS (port 443)
ufw allow 443/tcp

# Verify rules
ufw status

# Output should show:
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                     ALLOW       Anywhere
```

## Step 3: Setup SSH Key for GitHub Actions

Generate an SSH key on the VPS for GitHub Actions:

```bash
# Generate key (press Enter to use default location, leave passphrase empty)
ssh-keygen -t ed25519 -C "codearena-deploy" -f /opt/codearena/.ssh/deploy_key -N ""

# Display the private key
cat /opt/codearena/.ssh/deploy_key
```

Copy the **private key** content (starts with `-----BEGIN OPENSSH PRIVATE KEY-----`).

## Step 4: Configure GitHub Repository Secrets

### In GitHub Repository Settings:

1. Go to **Settings** → **Secrets and variables** → **Actions**

2. Create the following secrets by clicking **New repository secret**:

#### `VPS_HOST`
- **Value**: Your VPS IP or domain (e.g., `203.0.113.42` or `codearena.example.com`)

#### `VPS_USER`
- **Value**: SSH username (typically `root` or your deployment user)

#### `GITHUB_TOKEN` (optional)
- **Value**: GitHub/GitLab personal access token for private repositories

#### `VPS_SSH_KEY`
- **Value**: Paste the **entire private SSH key** from `/opt/codearena/.ssh/deploy_key`
  - Start with `-----BEGIN OPENSSH PRIVATE KEY-----`
  - End with `-----END OPENSSH PRIVATE KEY-----`
  - Include all newlines and content

### Verify Secrets

```bash
# In GitHub: Settings → Secrets → Verify all three are set
# They should show a green checkmark
```

## Step 5: Create Environment File

Create `.env.production` on the VPS:

```bash
cat > /opt/codearena/.env.production << 'EOF'
DOMAIN=codearena.example.com
ACME_EMAIL=admin@example.com
EOF

chmod 600 /opt/codearena/.env.production
```

Replace:
- `codearena.example.com` with your actual domain
- `admin@example.com` with your email (for Let's Encrypt notifications)

## Step 6: Test SSH Connection Manually

Before trusting GitHub Actions, test the SSH connection:

```bash
# From your local machine
ssh -i /path/to/private/key root@VPS_IP

# On the VPS, verify you can run Docker
docker ps
```

If this works, GitHub Actions will also be able to deploy.

## Step 7: Configure Deployment Environment Variables

Create a `.env` file in repository root if not present:

```bash
# Frontend API URL (internal to compose)
VITE_API_URL=http://backend:8080
```

## Step 8: Deploy Manually (First Time)

Test deployment by pushing to `main` branch:

```bash
# On your local machine
git add .
git commit -m "chore: prepare for deployment"
git push origin main
```

Monitor GitHub Actions:
1. Go to **Actions** tab in GitHub
2. Watch the workflow run
3. Check logs for any errors

### If Deployment Succeeds

The workflow will:
1. Run all tests (Go backend, frontend lint, Vitest)
2. Build Docker images for all languages
3. SSH into VPS and pull latest code
4. Run `docker compose -f docker-compose.prod.yml up --build -d`
5. Traefik will automatically obtain TLS certificate from Let's Encrypt

## Step 9: Verify Production Deployment

```bash
# SSH into VPS
ssh root@your-vps-ip

# Check running containers
cd /opt/codearena
docker compose -f docker-compose.prod.yml ps

# Expected output:
# NAME              STATUS              PORTS
# traefik           Up
# backend           Up
# frontend          Up
# compiler-images   Exited (0)

# Check Traefik logs for certificate issuance
docker compose -f docker-compose.prod.yml logs traefik | grep "ACME"

# Test HTTPS endpoint
curl -I https://codearena.example.com/

# Expected: HTTP 200 or redirect
```

## Monitoring & Troubleshooting

### View Logs

```bash
# Frontend logs
docker compose -f docker-compose.prod.yml logs frontend

# Backend logs
docker compose -f docker-compose.prod.yml logs backend

# Traefik logs (includes TLS certificate events)
docker compose -f docker-compose.prod.yml logs traefik

# All logs with timestamps
docker compose -f docker-compose.prod.yml logs -f --timestamps
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart just backend
docker compose -f docker-compose.prod.yml restart backend

# Full rebuild
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up --build -d
```

### Certificate Renewal

Let's Encrypt certificates are automatically renewed by Traefik. Check renewal logs:

```bash
docker compose -f docker-compose.prod.yml logs traefik | grep -i renew
```

### Rate Limiting Verification

API rate limiting is enforced at two levels:

1. **Backend (internal)**: 5 requests/sec, burst 15
2. **Traefik (external)**: Same limits applied at reverse proxy

Monitor rate limit hits:

```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i limit
```

## Security Checklist

- [ ] UFW firewall enabled with only ports 22, 80, 443 open
- [ ] SSH key stored securely in GitHub secrets (never commit to repo)
- [ ] GitHub secrets marked as private
- [ ] HTTPS enabled with valid certificate
- [ ] Traefik dashboard disabled (in docker-compose.prod.yml)
- [ ] Database backups configured (set up separate task)
- [ ] Log rotation configured
- [ ] Regular security updates on VPS

## Rollback

If deployment fails, rollback to previous version:

```bash
cd /opt/codearena
git checkout HEAD~1
docker compose -f docker-compose.prod.yml up --build -d
```

## Local Development

For local development without HTTPS:

```bash
# Use docker-compose.yml (not prod)
docker compose up --build

# Access at http://localhost:5173
```

## Additional Resources

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Traefik Let's Encrypt Configuration](https://doc.traefik.io/traefik/https/acme/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [UFW Firewall Guide](https://help.ubuntu.com/community/UFW)
