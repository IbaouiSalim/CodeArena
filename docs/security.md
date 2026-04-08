# Security

**Implemented by:** Mohamed Salim Ibaoui  
**Contact:** ibaouisalim@gmail.com

CodeArena safely executes untrusted code using multiple layers of protection.

## Defense Layers

Process Isolation: Each execution runs in a fresh Docker container that is discarded after completion. Containers run non-root and cannot access the host filesystem.

Resource Limits: Code execution is restricted by timeout (10s), memory (256MB), CPU (1 core), and output (64KB). Processes exceeding these limits are killed immediately.

Network Isolation: Network access is disabled. Code cannot make HTTP requests, DNS lookups, or any network connections.

Rate Limiting: 5 requests per second per IP address. Burst limit of 15 requests. Exceeding this returns HTTP 429.

Request Size: Maximum 5MB per request. Larger requests are rejected with HTTP 413.

## Attack Scenarios

Infinite Loop: Code runs until 10-second timeout kills it. Server unaffected.

Memory Bomb: Code allocates memory until 256MB limit triggers OOMKiller. Server unaffected.

Container Escape: Even if code breaks out of container, attacker cannot access host or other containers. Process runs as non-root user with limited filesystem.

Data Exfiltration: Network is disabled so data cannot be sent anywhere.

Denial of Service: Rate limiting allows only 5 requests per second. Attacks are rejected with HTTP 429.

Huge Payload: Requests larger than 5MB are rejected immediately.

## Production Checklist

HTTPS enabled with Let's Encrypt
Firewall configured (allow 22, 80, 443 only)
SSH hardened (key-based authentication)
Regular security updates applied
Rate limiting active
Logging enabled
Containers run non-root
Network isolation enabled
Resource limits enforced
Output truncation enabled

## Monitoring

Check logs for errors:
```bash
docker compose logs backend | grep error
```

Check for rate limit hits:
```bash
docker compose logs backend | grep "rate limit"
```

Check for timeouts:
```bash
docker compose logs backend | grep timeout
```

## References

Docker Security: https://docs.docker.com/engine/security
CIS Docker Benchmark: https://www.cisecurity.org/benchmark/docker

