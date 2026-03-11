package executor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// Language represents a supported programming language.
type Language string

const (
	LangPython     Language = "python"
	LangGo         Language = "go"
	LangCpp        Language = "cpp"
	LangRust       Language = "rust"
	LangJavascript Language = "javascript"
)

// Config holds the execution constraints.
type Config struct {
	Timeout   time.Duration // max execution time
	MemoryMB  int64         // memory limit in MB
	CPUCount  int64         // CPU core count
	MaxOutput int64         // max output bytes (stdout+stderr)
}

// DefaultConfig returns the standard execution limits.
func DefaultConfig() Config {
	return Config{
		Timeout:   10 * time.Second,
		MemoryMB:  256,
		CPUCount:  1,
		MaxOutput: 64 * 1024, // 64 KB
	}
}

// Request describes a code execution request.
type Request struct {
	Language Language `json:"language"`
	Code     string   `json:"code"`
	Stdin    string   `json:"stdin"`
}

// Result describes the execution output.
type Result struct {
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   int    `json:"exitCode"`
	DurationMs int64  `json:"durationMs"`
	WasTimeout bool   `json:"wasTimeout"`
}

// imageMap maps languages to Docker image names.
var imageMap = map[Language]string{
	LangPython:     "codearena-python",
	LangGo:         "codearena-go",
	LangCpp:        "codearena-cpp",
	LangRust:       "codearena-rust",
	LangJavascript: "codearena-javascript",
}

// Executor manages Docker-based code execution.
type Executor struct {
	cli *client.Client
	cfg Config
}

// New creates a new Executor with the given config.
func New(cfg Config) (*Executor, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}

	// Verify Docker is reachable
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = cli.Ping(ctx)
	if err != nil {
		return nil, fmt.Errorf("docker ping: %w", err)
	}

	return &Executor{cli: cli, cfg: cfg}, nil
}

// Close releases Docker client resources.
func (e *Executor) Close() error {
	return e.cli.Close()
}

// EnsureImages pulls or verifies all required images exist locally.
func (e *Executor) EnsureImages(ctx context.Context) error {
	for lang, img := range imageMap {
		_, _, err := e.cli.ImageInspectWithRaw(ctx, img)
		if err != nil {
			// Try to pull
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

// Run executes a code snippet and returns the result.
func (e *Executor) Run(ctx context.Context, req Request) (*Result, error) {
	imgName, ok := imageMap[req.Language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", req.Language)
	}

	// Build the command to run inside the container
	cmd := buildCommand(req.Language, req.Code, req.Stdin)

	// Create timeout context
	execCtx, cancel := context.WithTimeout(ctx, e.cfg.Timeout+5*time.Second)
	defer cancel()

	// Container configuration
	containerCfg := &container.Config{
		Image:        imgName,
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
		AttachStdin:  false,
		Tty:          false,
		NetworkDisabled: true,
		User:         "runner",
	}

	// Host configuration with resource limits
	hostCfg := &container.HostConfig{
		NetworkMode: "none",
		Resources: container.Resources{
			Memory:     e.cfg.MemoryMB * 1024 * 1024,
			MemorySwap: e.cfg.MemoryMB * 1024 * 1024, // no swap
			NanoCPUs:   e.cfg.CPUCount * 1e9,
			PidsLimit:  int64Ptr(256),
		},
		AutoRemove: false,
		ReadonlyRootfs: false,
	}

	// Create container
	resp, err := e.cli.ContainerCreate(execCtx, containerCfg, hostCfg, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("container create: %w", err)
	}
	containerID := resp.ID

	// Ensure cleanup
	defer func() {
		rmCtx, rmCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer rmCancel()
		e.cli.ContainerRemove(rmCtx, containerID, container.RemoveOptions{Force: true})
	}()

	// Start container
	if err := e.cli.ContainerStart(execCtx, containerID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("container start: %w", err)
	}

	start := time.Now()

	// Wait for completion with timeout
	waitTimeout := e.cfg.Timeout
	waitCtx, waitCancel := context.WithTimeout(ctx, waitTimeout+2*time.Second)
	defer waitCancel()

	statusCh, errCh := e.cli.ContainerWait(waitCtx, containerID, container.WaitConditionNotRunning)

	var result Result
	select {
	case err := <-errCh:
		if err != nil {
			// Could be a timeout
			if waitCtx.Err() != nil {
				// Kill the container
				stopCtx, stopCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer stopCancel()
				e.cli.ContainerKill(stopCtx, containerID, "SIGKILL")
				result.WasTimeout = true
				result.DurationMs = time.Since(start).Milliseconds()
				result.ExitCode = 137
				result.Stderr = "Execution timed out (limit: " + e.cfg.Timeout.String() + ")"
				return &result, nil
			}
			return nil, fmt.Errorf("container wait: %w", err)
		}
	case status := <-statusCh:
		result.DurationMs = time.Since(start).Milliseconds()
		result.ExitCode = int(status.StatusCode)
		if status.Error != nil {
			result.Stderr = status.Error.Message
		}
	case <-time.After(waitTimeout + 2*time.Second):
		// Timeout fallback
		stopCtx, stopCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer stopCancel()
		e.cli.ContainerKill(stopCtx, containerID, "SIGKILL")
		result.WasTimeout = true
		result.DurationMs = time.Since(start).Milliseconds()
		result.ExitCode = 137
		result.Stderr = "Execution timed out (limit: " + e.cfg.Timeout.String() + ")"
		return &result, nil
	}

	// Read logs (stdout + stderr)
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
	result.Stderr = truncate(stderrBuf.String(), e.cfg.MaxOutput)

	return &result, nil
}

// buildCommand creates the shell command for the given language.
func buildCommand(lang Language, code string, stdin string) []string {
	// We use /bin/sh -c to write code to a file and execute it.
	// stdin is passed via echo | pipe if provided.
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

// writeAndRun generates a shell script that:
// 1. Writes the code to a file using a heredoc
// 2. Optionally pipes stdin
// 3. Runs the command
func writeAndRun(code, stdin, filename, runCmd string) string {
	// Use a heredoc with a unique delimiter to write the code safely
	var sb strings.Builder

	// Write code to file using cat with heredoc
	sb.WriteString(fmt.Sprintf("cat > %s << 'CODEARENA_EOF'\n", filename))
	sb.WriteString(code)
	if !strings.HasSuffix(code, "\n") {
		sb.WriteString("\n")
	}
	sb.WriteString("CODEARENA_EOF\n")

	// Run with or without stdin
	if stdin != "" {
		// Write stdin to a file and pipe it
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

func truncate(s string, maxBytes int64) string {
	if int64(len(s)) > maxBytes {
		return s[:maxBytes] + "\n... [output truncated]"
	}
	return s
}

func int64Ptr(v int64) *int64 {
	return &v
}
