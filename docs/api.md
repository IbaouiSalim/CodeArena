# API Reference

## 1. Health Check

**GET /api/health**

Check if backend is running.

Response:
```json
{ "status": "ok" }
```

---

## 2. Execute Code (Quick Mode)

**POST /api/execute**

Run code and get complete results.

Request:
```json
{
  "language": "python",
  "code": "print('hello')",
  "stdin": ""
}
```

Response:
```json
{
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "durationMs": 120,
  "wasTimeout": false
}
```

Error responses:
- `400 Bad Request` - Invalid language or empty code
- `413 Payload Too Large` - Request exceeds 5MB
- `500 Internal Server Error` - Execution failed

---

## 3. Execute Code (Interactive Mode)

**WS /api/execute/ws**

WebSocket endpoint for real-time code execution with stdin/stdout streaming.

Connection flow:
1. Client opens WebSocket connection
2. Client sends start message:
```json
{
  "type": "start",
  "language": "python",
  "code": "name = input('Name: ')\nprint(f'Hello {name}')"
}
```
3. Server sends output messages:
```json
{ "type": "stdout", "data": "Name: " }
```
4. Client sends input:
```json
{ "type": "stdin", "data": "Alice\n" }
```
5. Server sends exit message:
```json
{ "type": "exit", "exitCode": 0, "duration": 142 }
```

Message types (server → client):
- `stdout` - Output chunk
- `stderr` - Error output chunk
- `exit` - Process finished with exit code and duration
- `error` - Server-side error

Message types (client → server):
- `start` - Begin execution (must be first)
- `stdin` - Send input to process

---

## 4. Save Snippet

**POST /api/snippets**

Save code snippet and get shareable token.

Request:
```json
{
  "language": "python",
  "code": "print('hello')",
  "stdin": "",
  "title": "Hello World"
}
```

Response:
```json
{ "token": "abc123xyz" }
```

---

## 5. Load Snippet

**GET /api/snippets/{token}**

Load saved snippet by token.

Response:
```json
{
  "token": "abc123xyz",
  "language": "python",
  "code": "print('hello')",
  "stdin": "",
  "title": "Hello World",
  "createdAt": "2026-02-11T12:00:00Z"
}
```

Error responses:
- `404 Not Found` - Token does not exist
- `500 Internal Server Error`

---

## Execution Limits

All code execution enforced by backend:
- **Timeout**: 10 seconds
- **Memory**: 256 MB (no swap)
- **CPU**: 1 core
- **Processes**: 256 max (fork bomb protection)
- **Network**: Disabled (no internet access)
- **Output**: 64 KB max (truncated beyond this)

---

## Rate Limiting

Per-IP token bucket rate limiting on `/api/execute` and `/api/snippets`:
- **Rate**: 5 requests/second
- **Burst**: 15 requests max

Exceeding limit returns `429 Too Many Requests`.

---

## Supported Languages

- `python` - Python 3
- `go` - Go 1.21+
- `cpp` - C++
- `rust` - Rust
- `javascript` - Node.js
