// Package executor runs code in isolated Docker containers for multiple programming languages
package executor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// Language represents a supported programming language
type Language string

const (
	LangPython     Language = "python"
	LangGo         Language = "go"
	LangCpp        Language = "cpp"
	LangRust       Language = "rust"
	LangJavascript Language = "javascript"
)

// Config specifies resource limits for code execution
type Config struct {
	Timeout   time.Duration
	MemoryMB  int64
	CPUCount  int64
	MaxOutput int64
}

// DefaultConfig returns recommended resource limits
func DefaultConfig() Config {
	return Config{
		Timeout:   10 * time.Second,
		MemoryMB:  256,
		CPUCount:  1,
		MaxOutput: 64 * 1024,
	}
}

// stripANSI removes ANSI color and formatting codes from text
func stripANSI(text string) string {
	// Matches ANSI escape sequences like [01m, [31m, [K, etc.
	ansiRegex := regexp.MustCompile(`\x1b\[[0-9;]*[mK]|\[[\d;]*m|\[K`)
	return ansiRegex.ReplaceAllString(text, "")
}

// Request contains the code to execute and input parameters
type Request struct {
	Language Language `json:"language"`
	Code     string   `json:"code"`
	Stdin    string   `json:"stdin"`
}

// Result contains execution output and metadata
type Result struct {
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   int    `json:"exitCode"`
	DurationMs int64  `json:"durationMs"`
	WasTimeout bool   `json:"wasTimeout"`
}

var imageMap = map[Language]string{
	LangPython:     "codearena-python",
	LangGo:         "codearena-go",
	LangCpp:        "codearena-cpp",
	LangRust:       "codearena-rust",
	LangJavascript: "codearena-javascript",
}

// Executor manages Docker container creation and code execution
type Executor struct {
	cli *client.Client
	cfg Config
}

// New creates an Executor and verifies Docker daemon is accessible
func New(cfg Config) (*Executor, error) {

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = cli.Ping(ctx)
	if err != nil {
		return nil, fmt.Errorf("docker ping: %w", err)
	}

	return &Executor{cli: cli, cfg: cfg}, nil
}

// Close closes the Docker client connection
func (e *Executor) Close() error {
	return e.cli.Close()
}

// EnsureImages verifies all language Docker images are available locally
func (e *Executor) EnsureImages(ctx context.Context) error {
	for lang, img := range imageMap {

		_, _, err := e.cli.ImageInspectWithRaw(ctx, img)
		if err != nil {

			reader, pullErr := e.cli.ImagePull(ctx, img, image.PullOptions{})
			if pullErr != nil {
				return fmt.Errorf("image %s (lang=%s): not found locally and pull failed: %w", img, lang, pullErr)
			}

			io.Copy(io.Discard, reader)
			reader.Close()
		}
	}
	return nil
}

// Run executes code in a Docker container and returns the result with stdout, stderr, and exit code
func (e *Executor) Run(ctx context.Context, req Request) (*Result, error) {

	imgName, ok := imageMap[req.Language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", req.Language)
	}

	cmd := buildCommand(req.Language, req.Code, req.Stdin)

	execCtx, cancel := context.WithTimeout(ctx, e.cfg.Timeout+5*time.Second)
	defer cancel()

	containerCfg := &container.Config{
		Image:           imgName,
		Cmd:             cmd,
		AttachStdout:    true,
		AttachStderr:    true,
		AttachStdin:     false,
		Tty:             false,
		NetworkDisabled: true,
		User:            "runner",
	}

	hostCfg := &container.HostConfig{
		NetworkMode: "none",
		Resources: container.Resources{
			Memory:     e.cfg.MemoryMB * 1024 * 1024,
			MemorySwap: e.cfg.MemoryMB * 1024 * 1024,
			NanoCPUs:   e.cfg.CPUCount * 1e9,
			PidsLimit:  int64Ptr(256),
		},
		AutoRemove:     false,
		ReadonlyRootfs: false,
	}

	resp, err := e.cli.ContainerCreate(execCtx, containerCfg, hostCfg, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("container create: %w", err)
	}
	containerID := resp.ID

	defer func() {
		rmCtx, rmCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer rmCancel()
		e.cli.ContainerRemove(rmCtx, containerID, container.RemoveOptions{Force: true})
	}()

	if err := e.cli.ContainerStart(execCtx, containerID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("container start: %w", err)
	}

	start := time.Now()
	waitTimeout := e.cfg.Timeout

	timeoutTimer := time.NewTimer(waitTimeout)
	defer timeoutTimer.Stop()

	go func() {
		<-timeoutTimer.C
		killCtx, killCancel := context.WithTimeout(context.Background(), 2*time.Second)
		e.cli.ContainerKill(killCtx, containerID, "SIGKILL")
		killCancel()
	}()

	waitCtx, waitCancel := context.WithTimeout(context.Background(), waitTimeout+5*time.Second)
	defer waitCancel()

	statusCh, errCh := e.cli.ContainerWait(waitCtx, containerID, container.WaitConditionNotRunning)

	var result Result
	select {
	case status := <-statusCh:

		elapsed := time.Since(start)
		result.DurationMs = elapsed.Milliseconds()
		result.ExitCode = int(status.StatusCode)
		if status.Error != nil {
			result.Stderr = status.Error.Message
		}

		if result.ExitCode == 137 {
			result.WasTimeout = true
			result.Stderr = "Execution timed out (limit: " + e.cfg.Timeout.String() + ")"
		}
	case err := <-errCh:
		elapsed := time.Since(start)
		if elapsed >= waitTimeout {

			result.WasTimeout = true
			result.DurationMs = elapsed.Milliseconds()
			result.ExitCode = 137
			result.Stderr = "Execution timed out (limit: " + e.cfg.Timeout.String() + ")"
		} else if err != nil {
			return nil, fmt.Errorf("container wait: %w", err)
		}
	case <-time.After(waitTimeout + 3*time.Second):

		killCtx, killCancel := context.WithTimeout(context.Background(), 2*time.Second)
		e.cli.ContainerKill(killCtx, containerID, "SIGKILL")
		killCancel()
		result.WasTimeout = true
		result.DurationMs = time.Since(start).Milliseconds()
		result.ExitCode = 137
		result.Stderr = "Execution timed out (limit: " + e.cfg.Timeout.String() + ")"
		return &result, nil
	}

	// Skip log retrieval if timeout occurred
	if !result.WasTimeout {
		logCtx, logCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer logCancel()

		logReader, err := e.cli.ContainerLogs(logCtx, containerID, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
		})
		if err != nil {
			return nil, fmt.Errorf("container logs: %w", err)
		}
		defer logReader.Close()

		var stdoutBuf, stderrBuf bytes.Buffer
		_, err = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, logReader)
		if err != nil {
			return nil, fmt.Errorf("reading logs: %w", err)
		}

		result.Stdout = truncate(stdoutBuf.String(), e.cfg.MaxOutput)
		result.Stderr = truncate(stripANSI(stderrBuf.String()), e.cfg.MaxOutput)
	}

	return &result, nil
}

// buildCommand creates a shell command array for executing code in a specific language
func buildCommand(lang Language, code string, stdin string) []string {
	switch lang {
	case LangPython:
		script := writeAndRun(code, stdin, "main.py", "python3 main.py")
		return []string{"/bin/sh", "-c", script}

	case LangGo:
		script := writeAndRun(code, stdin, "main.go", "go run main.go")
		return []string{"/bin/sh", "-c", script}

	case LangCpp:
		script := writeAndRun(code, stdin, "main.cpp", "g++ -o main main.cpp -std=c++17 && ./main")
		return []string{"/bin/sh", "-c", script}

	case LangRust:
		script := writeAndRun(code, stdin, "main.rs", "rustc -o main main.rs && ./main")
		return []string{"/bin/sh", "-c", script}

	case LangJavascript:
		script := writeAndRun(code, stdin, "main.js", "node main.js")
		return []string{"/bin/sh", "-c", script}

	default:
		return []string{"/bin/sh", "-c", "echo 'Unsupported language'"}
	}
}

// writeAndRun creates a shell script that writes code to a file, optionally pipes stdin, and executes it
func writeAndRun(code, stdin, filename, runCmd string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("cat > %s << 'CODEARENA_EOF'\n", filename))
	sb.WriteString(code)

	if !strings.HasSuffix(code, "\n") {
		sb.WriteString("\n")
	}
	sb.WriteString("CODEARENA_EOF\n")

	if stdin != "" {
		sb.WriteString("cat > _stdin.txt << 'STDIN_EOF'\n")
		sb.WriteString(stdin)
		if !strings.HasSuffix(stdin, "\n") {
			sb.WriteString("\n")
		}
		sb.WriteString("STDIN_EOF\n")
		sb.WriteString(fmt.Sprintf("cat _stdin.txt | %s", runCmd))
	} else {
		sb.WriteString(runCmd)
	}

	return sb.String()
}

// truncate limits a string to maxBytes and appends a truncation message if needed
func truncate(s string, maxBytes int64) string {
	if int64(len(s)) > maxBytes {
		return s[:maxBytes] + "\n... [output truncated]"
	}
	return s
}

// int64Ptr returns a pointer to the given int64 value
func int64Ptr(v int64) *int64 {
	return &v
}
