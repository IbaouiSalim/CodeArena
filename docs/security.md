# CodeArena – Security Concept (WP-1)

## 1. Threat Model
Attackers can submit arbitrary code. Potential attacks:
- Container escape attempts (privilege escalation)
- Denial-of-service (infinite loops, memory bombs, fork bombs, huge output)
- Network abuse (port scans, data exfiltration, bot activity)
- Abuse of public sharing links (hosting malicious content)

Goal: prevent host compromise and keep service available

## 2. Isolation Strategy
- Each execution runs in a fresh container
- Container is destroyed after execution
- No host volume mounts
- No persistent filesystem between runs
- Run as non-root user inside container

## 3. Resource Limits
- CPU limited to 1 core
- Memory limited to 256 MB (swap disabled)
- Execution timeout 10 seconds
- PID limit: 256 processes per container (fork bomb protection)
- Output size capped at 64 KB (stdout/stderr truncated beyond this to prevent log-based DoS)

## 4. Network Isolation
- Containers run with networking disabled
- No outbound/inbound connections from execution containers

## 5. Rate Limiting
- Application-level: token-bucket per IP (5 req/s, burst 15) on `/api/execute` and `/api/snippets`
- Reverse-proxy level: Traefik rate limiting middleware (10 avg, 20 burst) in production

## 6. Server Hardening
- Ubuntu 22.04 server
- Firewall (ufw): allow only 22, 80, 443
- HTTPS required via TLS (Let’s Encrypt)

## 7. Data / Privacy Notes
- Shared snippets are public
- UI warns users not to paste secrets (API keys, passwords)

## 8. Risk Management

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Container escape (privilege escalation) | Low | Critical | Non-root user, no volume mounts, no capabilities, network disabled, images kept up to date |
| Denial-of-service (infinite loops, memory bombs) | High | Medium | 10s timeout, 256 MB memory limit, 1 CPU core, automatic container cleanup |
| Fork bomb | High | Medium | PID limit of 256 per container |
| Log-based DoS (huge stdout/stderr) | Medium | Medium | Output truncated at 64 KB |
| Network abuse from containers | Medium | High | Networking disabled (`NetworkMode: none`) |
| Abuse of sharing links (malicious content) | Medium | Low | Snippets are code-only (no HTML rendering), public visibility discourages abuse |
| Database corruption / data loss | Low | Medium | SQLite WAL mode for crash resilience, regular backups recommended |
| Brute-force API abuse | Medium | Medium | Dual-layer rate limiting (application + Traefik), firewall limits open ports |
| Supply-chain attack on compiler images | Low | High | Minimal base images, pinned versions, no unnecessary packages |
| Host compromise via Docker socket | Low | Critical | Docker socket not exposed to execution containers, only backend has access |
