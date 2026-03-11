package store

import (
	"os"
	"testing"
)

func TestNewStore(t *testing.T) {
	dbPath := t.TempDir() + "/test.db"
	s, err := New(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer s.Close()
	defer os.Remove(dbPath)
}

func TestCreateAndGet(t *testing.T) {
	dbPath := t.TempDir() + "/test.db"
	s, err := New(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer s.Close()

	token, err := s.Create("python", `print("hello")`, "input data", "Test Snippet")
	if err != nil {
		t.Fatalf("Failed to create snippet: %v", err)
	}
	if token == "" {
		t.Fatal("Expected non-empty token")
	}
	if len(token) != 12 {
		t.Errorf("Expected 12-char token, got %d chars: %s", len(token), token)
	}

	snippet, err := s.Get(token)
	if err != nil {
		t.Fatalf("Failed to get snippet: %v", err)
	}
	if snippet == nil {
		t.Fatal("Expected snippet, got nil")
	}
	if snippet.Language != "python" {
		t.Errorf("Expected language 'python', got '%s'", snippet.Language)
	}
	if snippet.Code != `print("hello")` {
		t.Errorf("Code mismatch: %s", snippet.Code)
	}
	if snippet.Stdin != "input data" {
		t.Errorf("Stdin mismatch: %s", snippet.Stdin)
	}
	if snippet.Title != "Test Snippet" {
		t.Errorf("Title mismatch: %s", snippet.Title)
	}
	if snippet.CreatedAt == "" {
		t.Error("Expected non-empty CreatedAt")
	}
}

func TestGetNotFound(t *testing.T) {
	dbPath := t.TempDir() + "/test.db"
	s, err := New(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer s.Close()

	snippet, err := s.Get("nonexistent")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if snippet != nil {
		t.Errorf("Expected nil for non-existent token, got %+v", snippet)
	}
}

func TestCreateMultiple(t *testing.T) {
	dbPath := t.TempDir() + "/test.db"
	s, err := New(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer s.Close()

	tokens := make(map[string]bool)
	for i := 0; i < 10; i++ {
		token, err := s.Create("go", "package main", "", "")
		if err != nil {
			t.Fatalf("Create %d failed: %v", i, err)
		}
		if tokens[token] {
			t.Errorf("Duplicate token: %s", token)
		}
		tokens[token] = true
	}
}

func TestGenerateToken(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		token, err := generateToken()
		if err != nil {
			t.Fatalf("generateToken failed: %v", err)
		}
		if len(token) != 12 {
			t.Errorf("Expected 12-char token, got %d: %s", len(token), token)
		}
		if seen[token] {
			t.Errorf("Duplicate token generated: %s", token)
		}
		seen[token] = true
	}
}
