package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// Snippet represents a stored code snippet.
type Snippet struct {
	Token     string `json:"token"`
	Language  string `json:"language"`
	Code      string `json:"code"`
	Stdin     string `json:"stdin"`
	Title     string `json:"title"`
	CreatedAt string `json:"createdAt"`
}

// Store manages snippet persistence with SQLite.
type Store struct {
	db *sql.DB
}

// New opens (or creates) the SQLite database and ensures the schema exists.
func New(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// Create table if not exists
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS snippets (
			token      TEXT PRIMARY KEY,
			language   TEXT NOT NULL,
			code       TEXT NOT NULL,
			stdin      TEXT DEFAULT '',
			title      TEXT DEFAULT '',
			created_at TEXT NOT NULL
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("create table: %w", err)
	}

	return &Store{db: db}, nil
}

// Close releases the database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// Create stores a new snippet and returns the generated token.
func (s *Store) Create(language, code, stdin, title string) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	_, err = s.db.Exec(
		`INSERT INTO snippets (token, language, code, stdin, title, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		token, language, code, stdin, title, now,
	)
	if err != nil {
		return "", fmt.Errorf("insert snippet: %w", err)
	}

	return token, nil
}

// Get retrieves a snippet by its token.
func (s *Store) Get(token string) (*Snippet, error) {
	row := s.db.QueryRow(
		`SELECT token, language, code, stdin, title, created_at FROM snippets WHERE token = ?`,
		token,
	)

	var snippet Snippet
	err := row.Scan(&snippet.Token, &snippet.Language, &snippet.Code, &snippet.Stdin, &snippet.Title, &snippet.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query snippet: %w", err)
	}

	return &snippet, nil
}

func generateToken() (string, error) {
	b := make([]byte, 6) // 12 hex chars
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
