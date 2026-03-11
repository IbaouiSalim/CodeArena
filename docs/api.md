# CodeArena – API Contract (Draft)

This document defines how the frontend communicates with the Go backend.

- Base path: `/api`
- Format: JSON (`Content-Type: application/json`)
- Frontend calls these endpoints; backend responds with the JSON shapes below.

---

## 0) Health Check

### GET /api/health
Returns a simple status to verify the backend is running.

#### Response body (success)
```json
{ "status": "ok" }
```

#### Response
- `200 OK` – backend is healthy

---

## 1) Execute Code

### POST /api/execute
Runs a code snippet in an isolated container and returns the execution result.

#### Request body
```json
{
  "language": "python",
  "code": "print(\"Hello\")",
  "stdin": ""
}
```

#### Request fields
- `language` (string, required): one of `"go" | "python" | "cpp" | "rust" | "javascript"`
- `code` (string, required): source code
- `stdin` (string, optional): input passed to the program (default: empty string)

#### Response body (success)
```json
{
  "stdout": "Hello\n",
  "stderr": "",
  "exitCode": 0,
  "durationMs": 120,
  "wasTimeout": false
}
```

#### Response fields
- `stdout` (string): captured standard output
- `stderr` (string): captured error output (compile/runtime errors)
- `exitCode` (number): process exit code (0 = success)
- `durationMs` (number): total runtime in milliseconds (compile + run)
- `wasTimeout` (boolean): `true` if killed due to timeout

#### Error responses
- `400 Bad Request` – invalid JSON, unsupported language, empty code
- `413 Payload Too Large` – request too large
- `429 Too Many Requests` – rate limited (usually via reverse proxy)
- `500 Internal Server Error` – unexpected failure

---

## 2) Create Share Link (Store Snippet)

### POST /api/snippets
Stores a snippet and returns a short token for sharing.

#### Request body
```json
{
  "language": "python",
  "code": "print(\"Hello\")",
  "stdin": "",
  "title": "Hello World"
}
```

#### Request fields
- `language` (string, required): `"go" | "python" | "cpp" | "rust" | "javascript"`
- `code` (string, required)
- `stdin` (string, optional)
- `title` (string, optional)

#### Response body (success)
```json
{
  "token": "abc123"
}
```

Notes:
- The frontend can build a share URL like `/s/abc123`.

#### Error responses
- `400 Bad Request`
- `413 Payload Too Large`
- `500 Internal Server Error`

---

## 3) Load Shared Snippet

### GET /api/snippets/{token}
Loads a stored snippet by its share token.

#### Path parameter
- `token` (string): short identifier returned by `POST /api/snippets`

#### Response body (success)
```json
{
  "token": "abc123",
  "language": "python",
  "code": "print(\"Hello\")",
  "stdin": "",
  "title": "Hello World",
  "createdAt": "2026-02-11T12:00:00Z"
}
```

#### Error responses
- `404 Not Found` – token does not exist
- `500 Internal Server Error`

---

## 4) Interactive Execution (WebSocket)

### WS /api/execute/ws
WebSocket endpoint for interactive code execution with real-time stdin/stdout streaming.

#### Connection flow
1. Client opens a WebSocket connection to `/api/execute/ws`.
2. Client sends a **start message**:
```json
{
  "type": "start",
  "language": "python",
  "code": "name = input('Name: ')\nprint(f'Hello {name}')"
}
```
3. Server creates a Docker container with a PTY and streams output back.
4. Server sends **output messages**:
```json
{ "type": "stdout", "data": "Name: " }
```
5. Client can send **stdin input**:
```json
{ "type": "stdin", "data": "Alice\n" }
```
6. When execution completes, the server sends an **exit message**:
```json
{ "type": "exit", "exitCode": 0, "duration": 142 }
```
7. Connection closes.

#### Message types (server → client)
- `stdout` – standard output chunk
- `stderr` – standard error chunk
- `exit` – process finished (includes `exitCode` and `duration` in ms)
- `error` – server-side error

#### Message types (client → server)
- `start` – begin execution (must be first message)
- `stdin` – send input to the running process

---

## 5) Execution Limits (Enforced by Backend)

- Timeout: max **10 seconds**
- Memory: max **256 MB** (no swap)
- CPU: max **1 core**
- PIDs: max **256** (fork bomb protection)
- Network: **disabled** inside execution containers
- Output: max **64 KB** (truncated beyond this)

Frontend display rules (suggested):
- If `wasTimeout = true`, show: "Execution timed out."
- If `stderr` is not empty, show it as an error panel.

---

## 6) Rate Limiting

The backend enforces per-IP token-bucket rate limiting on `/api/execute` and `/api/snippets`:
- **Rate:** 5 requests/second
- **Burst:** 15 requests

Exceeding the limit returns `429 Too Many Requests`.
