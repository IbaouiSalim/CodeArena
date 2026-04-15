Security

CodeArena safely executes untrusted code using multiple layers of protection.

Defense Layers:
Process Isolation - Each execution runs in a fresh Docker container. Containers run non-root and cannot access the host filesystem.
Resource Limits - Timeout (10s), memory (256MB), CPU (1 core), output (64KB). Exceeding limits kills the process immediately.
Network Isolation - Network access disabled. No HTTP requests, DNS lookups, or network connections allowed.
Rate Limiting - 5 requests per second per IP, burst limit 15. Exceeding returns HTTP 429.
Request Size - Maximum 5MB per request. Larger requests rejected with HTTP 413.

Protection Against:
Infinite loops - 10-second timeout kills process
Memory exhaustion - 256MB limit triggers OOMKiller
Container escape - Non-root process, limited filesystem
Data exfiltration - Network disabled
Denial of service - Rate limiting enforcement
Large payloads - Size limit rejection

Production Setup:
Enable HTTPS with Let's Encrypt
Configure firewall (allow 22, 80, 443 only)
Harden SSH (key-based authentication)
Apply regular security updates
Verify rate limiting active
Enable logging
Run containers non-root
Enable network isolation
Enforce resource limits
Enable output truncation

Monitoring:
docker compose logs backend | grep error
docker compose logs backend | grep "rate limit"
docker compose logs backend | grep timeout

References:
Docker Security: https://docs.docker.com/engine/security
CIS Docker Benchmark: https://www.cisecurity.org/benchmark/docker

