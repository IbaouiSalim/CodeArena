package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"codearena/executor"
	"codearena/ratelimit"
	"codearena/store"

	"github.com/gorilla/websocket"
)

var (
	exec     *executor.Executor
	snippets *store.Store
	limiter  *ratelimit.Limiter
)

func main() {
	cfg := executor.DefaultConfig()
	var err error
	exec, err = executor.New(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize executor: %v", err)
	}
	defer exec.Close()

	log.Println("Checking Docker images...")
	if err := exec.EnsureImages(context.Background()); err != nil {
		log.Fatalf("Missing Docker images: %v", err)
	}

	snippets, err = store.New("codearena.db")
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer snippets.Close()

	limiter = ratelimit.New(5, 15)

	http.HandleFunc("/api/health", cors(healthHandler))
	http.HandleFunc("/api/execute", cors(limiter.Middleware(executeHandler)))
	http.HandleFunc("/api/execute/ws", wsExecuteHandler)
	http.HandleFunc("/api/snippets", cors(limiter.Middleware(snippetsHandler)))
	http.HandleFunc("/api/snippets/", cors(snippetByTokenHandler))

	log.Println("CodeArena backend running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func cors(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := os.Getenv("CORS_ORIGIN")
		if origin == "" {
			origin = "http://localhost:5173"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		h(w, r)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func executeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)

	var req executor.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if err.Error() == "http: request body too large" {
			http.Error(w, `{"error":"request body too large"}`, http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		}
		return
	}

	if req.Code == "" {
		http.Error(w, `{"error":"code is required"}`, http.StatusBadRequest)
		return
	}

	if req.Language != executor.LangPython && req.Language != executor.LangGo && req.Language != executor.LangCpp && req.Language != executor.LangRust && req.Language != executor.LangJavascript {
		http.Error(w, `{"error":"unsupported language, use: python, go, cpp, rust, javascript"}`, http.StatusBadRequest)
		return
	}

	log.Printf("Executing %s code (%d bytes)...", req.Language, len(req.Code))

	result, err := exec.Run(r.Context(), req)
	if err != nil {
		log.Printf("Execution error: %v", err)
		http.Error(w, `{"error":"execution failed"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Execution done: exit=%d, duration=%dms, timeout=%v",
		result.ExitCode, result.DurationMs, result.WasTimeout)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// snippetsHandler saves a code snippet (POST /api/snippets)
func snippetsHandler(w http.ResponseWriter, r *http.Request) {
	// Only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Limit request payload size to 5MB (prevent DoS with huge payloads)
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)

	// Parse the JSON request
	var req struct {
		Language string `json:"language"`
		Code     string `json:"code"`
		Stdin    string `json:"stdin"`
		Title    string `json:"title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if err.Error() == "http: request body too large" {
			http.Error(w, `{"error":"request body too large"}`, http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		}
		return
	}

	// Check required fields
	if req.Code == "" || req.Language == "" {
		http.Error(w, `{"error":"language and code are required"}`, http.StatusBadRequest)
		return
	}

	// Save snippet to database and get back a unique token (like a link shortener)
	token, err := snippets.Create(req.Language, req.Code, req.Stdin, req.Title)
	if err != nil {
		log.Printf("Snippet create error: %v", err)
		http.Error(w, `{"error":"failed to save snippet"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Snippet created: token=%s, lang=%s", token, req.Language)

	// Return the token so the user can share their code
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// ─────────────────────────────────────────────────────────────
// WebSocket handler for interactive execution (live terminal)
// ─────────────────────────────────────────────────────────────

// upgrader allows WebSocket connections from the frontend
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Get allowed origin from environment
		allowedOrigin := os.Getenv("CORS_ORIGIN")
		if allowedOrigin == "" {
			allowedOrigin = "http://localhost:5173" // Default to frontend dev server
		}
		return r.Header.Get("Origin") == allowedOrigin
	},
}

// wsExecuteHandler handles WebSocket connections for interactive code execution
func wsExecuteHandler(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Read the "start" message from the client (has language and code)
	var startMsg executor.WsMessage
	if err := conn.ReadJSON(&startMsg); err != nil {
		log.Printf("WebSocket read start error: %v", err)
		return
	}

	// Make sure it's actually a "start" message
	if startMsg.Type != "start" {
		executor.SendWsJSON(conn, executor.WsMessage{Type: "error", Message: "expected start message"})
		return
	}

	// Parse language
	lang := executor.Language(startMsg.Language)

	// Validate language
	if lang != executor.LangPython && lang != executor.LangGo && lang != executor.LangCpp && lang != executor.LangRust && lang != executor.LangJavascript {
		executor.SendWsJSON(conn, executor.WsMessage{Type: "error", Message: "unsupported language"})
		return
	}

	// Check that code is not empty
	if startMsg.Code == "" {
		executor.SendWsJSON(conn, executor.WsMessage{Type: "error", Message: "code is required"})
		return
	}

	log.Printf("[ws] Interactive execution: lang=%s, code=%d bytes", lang, len(startMsg.Code))

	// Run the code interactively (with live stdin/stdout/stderr over WebSocket)
	exec.RunInteractive(conn, lang, startMsg.Code)
}

// snippetByTokenHandler retrieves a saved snippet by token (GET /api/snippets/{token})
func snippetByTokenHandler(w http.ResponseWriter, r *http.Request) {
	// Only accept GET requests
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Extract token from URL path: /api/snippets/{token}
	path := strings.TrimPrefix(r.URL.Path, "/api/snippets/")
	if path == "" {
		http.Error(w, `{"error":"token required"}`, http.StatusBadRequest)
		return
	}

	// Get snippet from database
	snippet, err := snippets.Get(path)
	if err != nil {
		log.Printf("Snippet get error: %v", err)
		http.Error(w, `{"error":"failed to load snippet"}`, http.StatusInternalServerError)
		return
	}

	// Check if snippet exists
	if snippet == nil {
		http.Error(w, `{"error":"snippet not found"}`, http.StatusNotFound)
		return
	}

	// Return the snippet as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snippet)
}
