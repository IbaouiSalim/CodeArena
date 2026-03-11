package executor

import (
	"testing"
)

func TestBuildCommand_Python(t *testing.T) {
	cmd := buildCommand(LangPython, `print("hello")`, "")
	if len(cmd) != 3 {
		t.Fatalf("expected 3 args, got %d", len(cmd))
	}
	if cmd[0] != "/bin/sh" || cmd[1] != "-c" {
		t.Errorf("expected /bin/sh -c, got %s %s", cmd[0], cmd[1])
	}
	if !contains(cmd[2], "main.py") {
		t.Errorf("expected script to contain main.py, got: %s", cmd[2])
	}
	if !contains(cmd[2], "python3 main.py") {
		t.Errorf("expected script to contain python3 main.py, got: %s", cmd[2])
	}
}

func TestBuildCommand_Go(t *testing.T) {
	cmd := buildCommand(LangGo, `package main; func main() {}`, "")
	if !contains(cmd[2], "go run main.go") {
		t.Errorf("expected go run main.go in script")
	}
}

func TestBuildCommand_Cpp(t *testing.T) {
	cmd := buildCommand(LangCpp, `#include <iostream>`, "")
	if !contains(cmd[2], "g++ -o main main.cpp -std=c++17") {
		t.Errorf("expected g++ compile command in script")
	}
}

func TestBuildCommand_Rust(t *testing.T) {
	cmd := buildCommand(LangRust, `fn main() {}`, "")
	if !contains(cmd[2], "rustc -o main main.rs") {
		t.Errorf("expected rustc compile command in script")
	}
}

func TestBuildCommand_Javascript(t *testing.T) {
	cmd := buildCommand(LangJavascript, `console.log("hi")`, "")
	if !contains(cmd[2], "node main.js") {
		t.Errorf("expected node main.js in script")
	}
}

func TestBuildCommand_WithStdin(t *testing.T) {
	cmd := buildCommand(LangPython, `x = input()`, "hello\nworld")
	script := cmd[2]
	if !contains(script, "STDIN_EOF") {
		t.Errorf("expected stdin heredoc in script when stdin is provided")
	}
	if !contains(script, "_stdin.txt") {
		t.Errorf("expected _stdin.txt in script when stdin is provided")
	}
}

func TestBuildCommand_WithoutStdin(t *testing.T) {
	cmd := buildCommand(LangPython, `print("hi")`, "")
	script := cmd[2]
	if contains(script, "STDIN_EOF") {
		t.Errorf("should not have stdin heredoc when stdin is empty")
	}
}

func TestWriteAndRun_CodeEndsWithNewline(t *testing.T) {
	result := writeAndRun("print('hello')\n", "", "main.py", "python3 main.py")
	if !contains(result, "CODEARENA_EOF") {
		t.Errorf("expected heredoc delimiter")
	}
}

func TestWriteAndRun_CodeWithoutNewline(t *testing.T) {
	result := writeAndRun("print('hello')", "", "main.py", "python3 main.py")
	if !contains(result, "CODEARENA_EOF") {
		t.Errorf("expected heredoc delimiter")
	}
}

func TestTruncate_Short(t *testing.T) {
	result := truncate("hello", 100)
	if result != "hello" {
		t.Errorf("expected 'hello', got '%s'", result)
	}
}

func TestTruncate_Long(t *testing.T) {
	long := make([]byte, 200)
	for i := range long {
		long[i] = 'a'
	}
	result := truncate(string(long), 100)
	if len(result) < 100 {
		t.Errorf("expected truncated output, got len=%d", len(result))
	}
	if !contains(result, "[output truncated]") {
		t.Errorf("expected truncation marker")
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Timeout.Seconds() != 10 {
		t.Errorf("expected 10s timeout, got %v", cfg.Timeout)
	}
	if cfg.MemoryMB != 256 {
		t.Errorf("expected 256MB, got %d", cfg.MemoryMB)
	}
	if cfg.CPUCount != 1 {
		t.Errorf("expected 1 CPU, got %d", cfg.CPUCount)
	}
	if cfg.MaxOutput != 64*1024 {
		t.Errorf("expected 64KB max output, got %d", cfg.MaxOutput)
	}
}

func TestImageMap_AllLanguages(t *testing.T) {
	langs := []Language{LangPython, LangGo, LangCpp, LangRust, LangJavascript}
	for _, lang := range langs {
		img, ok := imageMap[lang]
		if !ok {
			t.Errorf("missing image for language %s", lang)
		}
		if img == "" {
			t.Errorf("empty image name for language %s", lang)
		}
	}
}

func TestInt64Ptr(t *testing.T) {
	val := int64Ptr(42)
	if *val != 42 {
		t.Errorf("expected 42, got %d", *val)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchStr(s, substr)
}

func searchStr(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
