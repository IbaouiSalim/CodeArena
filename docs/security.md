# Security

CodeArena runs untrusted code in isolated containers. Security is layered - if one layer fails, others catch it.

## Defense Layers

| Layer | Defense | Protects Against |
|-------|---------|------------------|
| Container | Docker isolation | Breakouts, host file access |
| Resources | CPU/Memory/Time limits | DoS attacks |
| Network | No internet | Data exfiltration |
| API | Rate limiting, size limits | Brute force |
| Transport | HTTPS/TLS | Eavesdropping |

## Container Isolation

Each code execution runs in a fresh container that is discarded afterward.

### Non-Root User

Code runs as user `runner`, not root:

```dockerfile
RUN useradd -m -s /bin/bash runner
USER runner
```

This prevents:
- Writing to system files
- Docker socket access
- Container escape
- Privilege escalation

### Limited Filesystem

Code can only write to `/tmp` and `/home/runner`:

```go
Tmpfs: map[string]string{
    "/tmp": "size=128m,noexec",
}
```

The `noexec` flag prevents executing files from `/tmp`.

### Process Limit

Maximum 256 processes per container (fork bomb protection):

```go
PidsLimit: int64Ptr(256)
```

## Resource Limits

### Timeout: 10 seconds

Code that runs longer than 10 seconds gets killed:

```go
ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
defer cancel()
```

Prevents infinite loops and hanging processes.

### Memory: 256 MB

Hard limit per execution:

```go
Memory:     256 * 1024 * 1024,
MemorySwap: -1,  // No swap
```

Prevents memory exhaustion attacks.

### CPU: 1 core

```go
CPUs: "1.00"
```

Prevents multi-core exhaustion.

### Output: 64 KB max

Output larger than 64 KB is truncated to prevent buffer exhaustion.

## Network Isolation

No network access:

```go
NetworkMode: "none"
```

Code cannot:
- Make HTTP requests
- SSH to other machines
- Exfiltrate data
- Reach external servers

## API Security

### Request Size Limit

Maximum 5 MB per request:

```go
r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)
```

Returns HTTP 413 if exceeded.

### Rate Limiting

Token bucket: 5 requests/second per IP, burst of 15:

```go
limiter = ratelimit.New(5, 15)
```

Prevents brute force and DoS attacks.

### Input Validation

- Only allowed languages accepted
- Code cannot be empty
- Language must be recognized

### CORS Validation

Only requests from authorized origin allowed:

```go
origin := os.Getenv("CORS_ORIGIN")
w.Header().Set("Access-Control-Allow-Origin", origin)
```

WebSocket also validates origin header.

## Deployment Security

### HTTPS/TLS Required

All HTTP traffic redirects to HTTPS:

```yaml
--entrypoints.web.http.redirections.entrypoint.scheme=https
```

Let's Encrypt provides automatic certificates.

### Firewall

Default deny policy:

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirects)
sudo ufw allow 443/tcp  # HTTPS
```

Only 3 ports open.

## Attack Scenarios

### Infinite Loop
Code runs forever consuming CPU. Defense: 10-second timeout kills it. Server unaffected.

### Memory Bomb
Code allocates gigabytes of memory. Defense: 256 MB limit kills process. Server unaffected.

### Container Escape
Exploits Docker vulnerability to break out. Defense: Non-root user, limited filesystem, network disabled. Even if escape succeeds, attacker cannot reach host or other containers.

### Data Exfiltration
Code tries to send data to attacker server. Defense: Network disabled, HTTP requests fail with "Network unreachable".

### DoS via Rate Limit
Sends 1000 requests/second. Defense: Rate limit allows 5/sec, burst 15. Subsequent requests rejected with HTTP 429.

### Huge Payload
Sends multi-GB upload. Defense: 5 MB limit rejects with HTTP 413.

## Monitoring

Check logs for suspicious activity:

```bash
# Failed executions
docker compose -f docker-compose.prod.yml logs backend | grep error

# Timeouts (could indicate attacks)
docker compose -f docker-compose.prod.yml logs backend | grep timeout

# Rate limiting hits
docker compose -f docker-compose.prod.yml logs backend | grep "rate limit"
```

## Checklist

- Non-root user in containers
- Network isolated
- Resource limits enforced
- Request size limited
- Rate limiting active
- CORS validation
- WebSocket origin validation
- HTTPS/TLS enforced
- Firewall configured
- Output truncation enabled
- Timeout protection active

## References

- [Docker Security Docs](https://docs.docker.com/engine/security/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker/)
- [Container Escape Case Studies](https://blog.trailofbits.com/2019/07/19/understanding-docker-container-escapes/)

**Threat**: User submits infinite loop or memory leak

**Mitigation**:
✅ 10-second timeout kills process
✅ 256MB memory limit triggers OOMKiller
✅ CPU rate limiting prevents 100% utilization
✅ Output truncation prevents memory exhaustion

**Result**: Process terminates safely, no host impact

---

### Attack Vector: Container Escape

**Threat**: User exploits Docker kernel vulnerability

**Mitigation**:
✅ Non-root user prevents privilege escalation
✅ Read-only root filesystem limits attack surface
✅ Network disabled prevents post-exploitation communication
✅ Process isolation (256 PID limit) prevents process hijacking
✅ Docker regularly updated patches kernel

**Result**: Even if escape occurs, attacker cannot reach other containers/host data

---

### Attack Vector: Denial of Service (DoS)

**Threat**: Attacker floods API with requests

**Mitigation**:
✅ Rate limiting: 5 requests/second per IP
✅ Payload limit: 5MB per request
✅ Timeout: 10s per execution (prevents backend starvation)
✅ Traefik reverse proxy can absorb/buffer requests

**Example Attack & Defense**:
```bash
# Attack: 100 requests/second
for i in {1..1000}; do curl https://codearena.example.com/api/execute & done

# Defense Response:
# - First 5 requests: processed (1 per second)
# - Requests 6-15: queued (burst allowance)
# - Requests 16+: rejected with HTTP 429
# - Backend never overloaded
```

---

### Attack Vector: Data Exfiltration

**Threat**: User submits code that reads/exfiltrates shared code

**Mitigation**:
✅ Network disabled (no outbound connections)
✅ Process isolated (cannot read other containers)
✅ Filesystem isolated (cannot read host files)
✅ Code snippets public (by design, users warned)

**Result**: Cannot transmit stolen data, cannot access host/other users

---

### Attack Vector: Privilege Escalation

**Threat**: User attempts `sudo` or `su` commands

**Mitigation**:
✅ No sudo/su installed in compiler images
✅ User `runner` has no password
✅ Cannot escalate to root or access Docker socket

```bash
# This fails in CodeArena:
$ sudo -i
sudo: command not found

$ su -
su: Authentication token manipulation error
```

---

## Compliance & Audit

### Security Checklist

- [x] Non-root user execution in containers
- [x] Network isolation enabled
- [x] Resource limits enforced
- [x] Request payload size limited
- [x] Rate limiting enabled
- [x] CORS validation
- [x] WebSocket origin validation
- [x] TLS/HTTPS enforced
- [x] Firewall configured (ufw)
- [x] Output truncation
- [x] Timeout protection

### Monitoring & Logging

Enable debug logging to monitor security events:

```bash
# View all API requests and executions
docker compose -f docker-compose.prod.yml logs backend

# Filter for errors/attacks
docker compose -f docker-compose.prod.yml logs backend | grep -i error
docker compose -f docker-compose.prod.yml logs backend | grep -i timeout
docker compose -f docker-compose.prod.yml logs backend | grep -i limit
```

---

## Incident Response

### Memory Leak Detected

```
Error: container: memory limit exceeded
```

**Response**:
1. Container terminated automatically
2. User receives error response
3. Check logs for problematic code
4. No system impact

### Rate Limit Abuse Detected

```
Multiple HTTP 429 responses from single IP
```

**Response**:
1. Requests from that IP throttled automatically
2. Optional: Block IP via firewall rules
3. Monitor for attack patterns
4. Contact IP owner if legitimate

### Timeout Abuse Detected

```
Multiple timeout responses from single IP
```

**Response**:
1. User may be debugging code
2. Increase timeout locally during dev (not production)
3. Monitor for sustained attacks
4. Block IP if abuse confirmed

---

## Future Security Improvements

1. **gVisor Runtime**: Additional sandbox with seccomp filtering
2. **eBPF Monitoring**: Real-time syscall monitoring for escape attempts
3. **Web Application Firewall**: Rate limiting per code snippet
4. **Secret Detection**: Warn if API keys / credentials detected in code
5. **Audit Logging**: Immutable log of all executions for compliance

---

## References

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker/)
- [OWASP Container Security Cheat Sheet](https://cheatsheetseries.owasp.org/)
- [Container Escape PoCs](https://blog.trailofbits.com/2019/07/19/understanding-docker-container-escapes/)
