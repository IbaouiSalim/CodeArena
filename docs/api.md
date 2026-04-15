API Reference

Health Check
GET /api/health
Response: { status: ok }

Execute Code
POST /api/execute
Request: language, code, stdin
Response: stdout, stderr, exitCode, durationMs, wasTimeout

Languages: python, go, cpp, rust, javascript

Execute Interactive
WS /api/execute/ws
WebSocket for real-time execution with stdin/stdout.
Client sends: type (start or stdin), language, code, data
Server sends: type (stdout, stderr, exit), data, exitCode, duration

Save Snippet
POST /api/snippets
Request: language, code, title
Response: token

Load Snippet
GET /api/snippets/{token}
Response: token, language, code, title, createdAt

Limits:
Timeout: 10 seconds
Memory: 256 MB
CPU: 1 core
Output: 64 KB
Network: Disabled

Rate Limiting:
5 requests/second per IP
Burst: 15 requests max
Exceeds return: HTTP 429
