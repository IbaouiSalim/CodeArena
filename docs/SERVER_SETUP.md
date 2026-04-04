# Server Setup Guide

Complete instructions for setting up a production Ubuntu 22.04 VPS to host CodeArena with security hardening.

## Overview

This guide covers:
- System hardening
- UFW firewall configuration
- Docker installation and setup
- SSH key management
- Fail2ban for brute-force protection
- Automated backups

## 1. Initial VPS Setup

### 1.1 Connect to VPS

```bash
ssh root@your.vps.ip.address
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
apt autoremove -y
```

### 1.3 Set Hostname

```bash
hostnamectl set-hostname codearena
echo "127.0.0.1 codearena" >> /etc/hosts
```

### 1.4 Set Timezone

```bash
timedatectl set-timezone UTC
# Or your preferred timezone: timedatectl list-timezones
```

## 2. SSH Hardening

### 2.1 Create SSH Key Pair (on local machine)

```bash
ssh-keygen -t ed25519 -C "codearena-admin" -f ~/.ssh/codearena_key
```

### 2.2 Disable Password Authentication

```bash
# On VPS, edit SSH config
sudo nano /etc/ssh/sshd_config

# Change these settings:
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
```

### 2.3 Reload SSH Service

```bash
systemctl reload sshd
```

### 2.4 Create Deployment User (Optional but Recommended)

```bash
# Create user for deployments
adduser codearena --disabled-password --gecos ""

# Add to docker group (so they can run docker commands)
usermod -aG docker codearena

# Setup sudo without password for deployment commands
echo "codearena ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/docker-compose" | sudo tee /etc/sudoers.d/codearena
```

## 3. UFW Firewall Configuration

### 3.1 Enable UFW

```bash
# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Enable UFW
ufw enable

# Type 'y' and press Enter to confirm
```

### 3.2 Allow Required Ports

```bash
# SSH (critical - don't lock yourself out!)
ufw allow 22/tcp

# HTTP (for Let's Encrypt challenge and redirects)
ufw allow 80/tcp

# HTTPS (primary access)
ufw allow 443/tcp

# Optional: Specific IP for SSH (more secure)
# ufw allow from 203.0.113.0/24 to any port 22
```

### 3.3 Verify Firewall Status

```bash
ufw status verbose

# Expected output:
# Status: active
# Logging: on (low)
# Default: deny (incoming), allow (outgoing), disabled (routed)
# New profiles: skip
# 
#                    Action      From
#                    ------      ----
# 22/tcp              ALLOW       Anywhere
# 80/tcp              ALLOW       Anywhere
# 443/tcp             ALLOW       Anywhere
# 22/tcp (v6)         ALLOW       Anywhere (v6)
# 80/tcp (v6)         ALLOW       Anywhere (v6)
# 443/tcp (v6)        ALLOW       Anywhere (v6)
```

### 3.4 Enable UFW Logging (Optional)

```bash
# Low verbosity (recommended)
ufw logging low

# Or medium/high for debugging
# ufw logging medium
```

## 4. Install Docker

### 4.1 Install Docker Engine

```bash
# Set up Docker repository
apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker daemon
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
```

### 4.2 Install Docker Compose

```bash
# Download latest release
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
chmod +x /usr/local/bin/docker-compose

# Verify
docker-compose --version
```

### 4.3 Configure Docker Security

```bash
# Add user to docker group (so sudo isn't needed every time)
usermod -aG docker codearena

# IMPORTANT: This grants container privileges - only add trusted users!

# Restart docker
systemctl restart docker

# Verify (as codearena user)
sudo su - codearena
docker ps
```

## 5. Fail2ban Installation (Brute-Force Protection)

### 5.1 Install Fail2ban

```bash
apt install -y fail2ban

# Start and enable
systemctl start fail2ban
systemctl enable fail2ban
```

### 5.2 Configure Fail2ban for SSH

```bash
# Create local config (don't edit defaults)
nano /etc/fail2ban/jail.local

# Add this content:
[DEFAULT]
maxretry = 5
findtime = 600
bantime = 3600

[sshd]
enabled = true
filter = sshd
port = ssh
logpath = /var/log/auth.log
```

### 5.3 Restart Fail2ban

```bash
systemctl restart fail2ban

# Verify status
fail2ban-client status
fail2ban-client status sshd
```

## 6. Network Configuration

### 6.1 Enable IP Forwarding (Required for Docker)

```bash
# Check current status
cat /proc/sys/net/ipv4/ip_forward

# Enable if not already
echo 1 > /proc/sys/net/ipv4/ip_forward

# Make permanent
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p
```

### 6.2 Configure UFW to Respect Docker

```bash
# Create UFW rules for Docker
nano /etc/ufw/before.rules

# Add before the "*filter" line (around line 84):
*nat
:PREROUTING ACCEPT [0:0]
:DOCKER - [0:0]
-A PREROUTING -m addrtype --dst-type LOCAL -j DOCKER
-A DOCKER -i docker0 -j RETURN
COMMIT
```

Reload UFW:
```bash
ufw reload
```

## 7. Create Application Directory

```bash
# Create directory
mkdir -p /opt/codearena
cd /opt/codearena

# Initialize git repository
git init
git config user.email "deploy@codearena.local"
git config user.name "CodeArena Deploy"

# Add remote (will be used by GitHub Actions)
git remote add origin https://github.com/YOUR_ORG/codearena.git

# Grant permissions to codearena user
chown -R codearena:codearena /opt/codearena
```

## 8. Environment Configuration

```bash
# Create environment file for production
cat > /opt/codearena/.env << 'EOF'
# Domain for Traefik and Let's Encrypt
DOMAIN=codearena.example.com

# Email for Let's Encrypt certificate notifications
ACME_EMAIL=admin@example.com

# Must match DOMAIN for frontend API calls
VITE_API_URL=https://codearena.example.com/api
EOF

# Secure permissions
chmod 600 /opt/codearena/.env
```

## 9. Log Rotation

### 9.1 Configure Docker Log Rotation

```bash
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5",
    "labels": "codearena"
  }
}
EOF

systemctl restart docker
```

### 9.2 Configure System Log Rotation

```bash
cat > /etc/logrotate.d/codearena << 'EOF'
/var/log/codearena/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 codearena codearena
    sharedscripts
}
EOF
```

## 10. Monitoring Setup (Optional)

### 10.1 Install Monitoring Tools

```bash
# htop for process monitoring
apt install -y htop

# nethogs for network monitoring
apt install -y nethogs
```

### 10.2 Setup Disk Space Monitoring

```bash
# Check disk usage
df -h

# Create alert script
cat > /usr/local/bin/check-disk.sh << 'EOF'
#!/bin/bash
THRESHOLD=80
USAGE=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
if [ $USAGE -gt $THRESHOLD ]; then
  echo "WARNING: Disk usage at $USAGE%" | mail -s "Disk Alert" admin@example.com
fi
EOF

chmod +x /usr/local/bin/check-disk.sh

# Add to crontab to run daily
crontab -e
# Add: 0 2 * * * /usr/local/bin/check-disk.sh
```

## 11. Backup Strategy

### 11.1 Backup Database and Data

```bash
# Create backup directory
mkdir -p /backups/codearena
chmod 700 /backups/codearena

# Create backup script
cat > /usr/local/bin/backup-codearena.sh << 'EOF'
#!/bin/bash
cd /opt/codearena
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/codearena/backup_$BACKUP_DATE.tar.gz"

# Backup data directory
tar -czf $BACKUP_FILE ./backend/data/ 2>/dev/null || true

# Keep only last 7 days of backups
find /backups/codearena -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
EOF

chmod +x /usr/local/bin/backup-codearena.sh

# Schedule daily backups at 3 AM
cat >> /etc/crontab << 'EOF'
0 3 * * * root /usr/local/bin/backup-codearena.sh
EOF
```

## 12. Security Checklist

- [ ] SSH key-only authentication enabled
- [ ] UFW firewall configured (ports 22, 80, 443 only)
- [ ] UFW logging enabled
- [ ] Fail2ban configured and running
- [ ] Docker latest version installed
- [ ] IP forwarding enabled
- [ ] System timezone set correctly
- [ ] Unattended security updates configured
- [ ] Backup strategy implemented
- [ ] Monitoring tools installed
- [ ] SSH port changed from default (optional, advanced)
- [ ] Two-factor authentication set up (optional)

## 13. Verify Server Security

```bash
# Check open ports
sudo ss -tuln | grep LISTEN

# Expected to see:
# tcp  LISTEN 0 128 0.0.0.0:22
# tcp  LISTEN 0 128 0.0.0.0:80
# tcp  LISTEN 0 128 0.0.0.0:443

# Check firewall status
ufw status numbered

# Check Docker
docker ps

# Check disk space
df -h

# Check memory
free -h

# Check CPU
nproc
```

## 14. Additional Security Hardening

### 14.1 Disable Unnecessary Services

```bash
# Check running services
systemctl list-units --type=service --state=running

# Disable if not needed:
# systemctl disable postgresql
# systemctl disable mysql
# etc.
```

### 14.2 Install Lynis (Security Auditor)

```bash
apt install -y lynis
lynis audit system --quick

# Review output for recommendations
```

### 14.3 Enable Ubuntu Auto-Updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

## Troubleshooting

### Cannot SSH to VPS

```bash
# Check SSH is listening
netstat -tuln | grep :22

# Check SSH logs
tail -f /var/log/auth.log

# Restart SSH
systemctl restart sshd
```

### Docker Command Permission Denied

```bash
# Ensure user is in docker group
usermod -aG docker $USER

# Apply group changes without logout
newgrp docker

# Test
docker ps
```

### Firewall Blocking Services

```bash
# Temporarily disable to test
ufw disable

# Re-enable after testing
ufw enable

# View detailed firewall log
grep UFW /var/log/syslog | tail -20
```

## Next Steps

Once server is ready:
1. Set up GitHub Actions secrets (see DEPLOYMENT.md)
2. Push code to main branch to trigger deployment
3. Monitor Docker Compose services
4. Verify HTTPS certificate issuance
5. Test application functionality
