# Server Setup

## Initial Setup

```bash
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Set timezone
timedatectl set-timezone UTC
```

## SSH Hardening

Create SSH key locally:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/codearena_key
```

On VPS, edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
```

Reload SSH:
```bash
systemctl reload sshd
```

## Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

## Deployment User (Optional)

```bash
# Create non-root deployment user
adduser codearena --disabled-password --gecos ""
usermod -aG docker codearena
```

## Application Setup

```bash
mkdir -p /opt/codearena
cd /opt/codearena
git clone https://git.fh-aachen.de/codearenaproject/codearena.git .
docker compose -f docker-compose.prod.yml up -d
```

## Verification

```bash
docker compose ps
curl -I https://your-domain.com/
```

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
