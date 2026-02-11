# CodeArena – API Contract (Draft)

This document defines how the frontend communicates with the Go backend.

- Base path: `/api`
- Format: JSON (`Content-Type: application/json`)
- Frontend calls these endpoints; backend responds with the JSON shapes below.

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
- `language` (string, required): one of `"go" | "python" | "cpp"`
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
- `language` (string, required): `"go" | "python" | "cpp"`
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

## 4) Execution Limits (Enforced by Backend)

- Timeout: max **10 seconds**
- Memory: max **256 MB**
- CPU: max **1 core**
- Network: **disabled** inside execution containers

Frontend display rules (suggested):
- If `wasTimeout = true`, show: “Execution timed out.”
- If `stderr` is not empty, show it as an error panel.
