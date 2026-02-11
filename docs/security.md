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
- Memory limited to 256 MB
- Execution timeout 10 seconds
- Output size capped (stdout/stderr) to prevent log-based DoS

## 4. Network Isolation
- Containers run with networking disabled
- No outbound/inbound connections from execution containers

## 5. Rate Limiting
- Apply rate limiting at the reverse proxy (Traefik/Nginx) to protect `/api/execute`

## 6. Server Hardening
- Ubuntu 22.04 server
- Firewall (ufw): allow only 22, 80, 443
- HTTPS required via TLS (Let’s Encrypt)

## 7. Data / Privacy Notes
- Shared snippets are public
- UI warns users not to paste secrets (API keys, passwords)
