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
	// Initialize the executor (Docker client)
	cfg := executor.DefaultConfig()
	var err error
	exec, err = executor.New(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize executor: %v", err)
	}
	defer exec.Close()

	// Verify all compiler images exist
	log.Println("Checking Docker images...")
	if err := exec.EnsureImages(context.Background()); err != nil {
		log.Fatalf("Missing Docker images: %v", err)
	}
	log.Println("All compiler images ready.")

	// Initialize the snippet store (SQLite)
	snippets, err = store.New("codearena.db")
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer snippets.Close()
	log.Println("Database ready.")

	// Rate limiter: 5 requests/sec, burst of 15
	limiter = ratelimit.New(5, 15)

	// Routes
	http.HandleFunc("/api/health", cors(healthHandler))
	http.HandleFunc("/api/execute", cors(limiter.Middleware(executeHandler)))
	http.HandleFunc("/api/execute/ws", wsExecuteHandler) // WebSocket — no CORS wrapper
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
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func executeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req executor.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Validate
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

// snippetsHandler handles POST /api/snippets (create)
func snippetsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Language string `json:"language"`
		Code     string `json:"code"`
		Stdin    string `json:"stdin"`
		Title    string `json:"title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || req.Language == "" {
		http.Error(w, `{"error":"language and code are required"}`, http.StatusBadRequest)
		return
	}

	token, err := snippets.Create(req.Language, req.Code, req.Stdin, req.Title)
	if err != nil {
		log.Printf("Snippet create error: %v", err)
		http.Error(w, `{"error":"failed to save snippet"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Snippet created: token=%s, lang=%s", token, req.Language)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// ── WebSocket handler for interactive execution ──

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

func wsExecuteHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Read the start message from the client
	var startMsg executor.WsMessage
	if err := conn.ReadJSON(&startMsg); err != nil {
		log.Printf("WebSocket read start error: %v", err)
		return
	}

	if startMsg.Type != "start" {
		executor.SendWsJSON(conn, executor.WsMessage{Type: "error", Message: "expected start message"})
		return
	}

	// Validate
	lang := executor.Language(startMsg.Language)
	if lang != executor.LangPython && lang != executor.LangGo && lang != executor.LangCpp && lang != executor.LangRust && lang != executor.LangJavascript {
		executor.SendWsJSON(conn, executor.WsMessage{Type: "error", Message: "unsupported language"})
		return
	}

	if startMsg.Code == "" {
		executor.SendWsJSON(conn, executor.WsMessage{Type: "error", Message: "code is required"})
		return
	}

	log.Printf("[ws] Interactive execution: lang=%s, code=%d bytes", lang, len(startMsg.Code))

	// Run interactively — this blocks until the container exits
	exec.RunInteractive(conn, lang, startMsg.Code)
}

// snippetByTokenHandler handles GET /api/snippets/{token}
func snippetByTokenHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Extract token from path: /api/snippets/{token}
	path := strings.TrimPrefix(r.URL.Path, "/api/snippets/")
	if path == "" {
		http.Error(w, `{"error":"token required"}`, http.StatusBadRequest)
		return
	}

	snippet, err := snippets.Get(path)
	if err != nil {
		log.Printf("Snippet get error: %v", err)
		http.Error(w, `{"error":"failed to load snippet"}`, http.StatusInternalServerError)
		return
	}

	if snippet == nil {
		http.Error(w, `{"error":"snippet not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snippet)
}
