package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/gorilla/websocket"
)

type WsMessage struct {
	Type       string `json:"type"`
	Data       string `json:"data,omitempty"`
	Language   string `json:"language,omitempty"`
	Code       string `json:"code,omitempty"`
	ExitCode   int    `json:"exitCode,omitempty"`
	DurationMs int64  `json:"durationMs,omitempty"`
	WasTimeout bool   `json:"wasTimeout,omitempty"`
	Message    string `json:"message,omitempty"`
}

func SendWsJSON(ws *websocket.Conn, msg WsMessage) {
	data, _ := json.Marshal(msg)
	ws.WriteMessage(websocket.TextMessage, data)
}

func sendWsError(ws *websocket.Conn, message string) {
	SendWsJSON(ws, WsMessage{Type: "error", Message: message})
}

// RunInteractive runs code in a Docker container with interactive stdin/stdout
// over a WebSocket connection. The container uses a PTY so output includes
// echoed input, behaving like a real terminal.
func (e *Executor) RunInteractive(ws *websocket.Conn, lang Language, code string) {
	ctx, cancel := context.WithTimeout(context.Background(), e.cfg.Timeout+10*time.Second)
	defer cancel()

	imgName, ok := imageMap[lang]
	if !ok {
		sendWsError(ws, "unsupported language")
		return
	}

	// Build the command — no stdin piping, stdin comes from attached PTY
	cmd := buildInteractiveCommand(lang, code)

	// Container config: TTY + interactive stdin
	containerCfg := &container.Config{
		Image:           imgName,
		Cmd:             cmd,
		Tty:             true,
		OpenStdin:       true,
		AttachStdin:     true,
		AttachStdout:    true,
		AttachStderr:    true,
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

	// Create container
	resp, err := e.cli.ContainerCreate(ctx, containerCfg, hostCfg, nil, nil, "")
	if err != nil {
		sendWsError(ws, "failed to create container: "+err.Error())
		return
	}
	containerID := resp.ID
	log.Printf("[interactive] Container created: %s (lang=%s)", containerID[:12], lang)

	defer func() {
		rmCtx, rmCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer rmCancel()
		e.cli.ContainerRemove(rmCtx, containerID, container.RemoveOptions{Force: true})
		log.Printf("[interactive] Container removed: %s", containerID[:12])
	}()

	hijack, err := e.cli.ContainerAttach(ctx, containerID, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
		Stderr: true,
	})
	if err != nil {
		sendWsError(ws, "failed to attach to container: "+err.Error())
		return
	}
	defer hijack.Close()

	if err := e.cli.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		sendWsError(ws, "failed to start container: "+err.Error())
		return
	}

	start := time.Now()

	waitTimeout := e.cfg.Timeout

	// Goroutine: read container output (TTY raw) → send to WebSocket
	outputDone := make(chan struct{})
	go func() {
		defer close(outputDone)
		buf := make([]byte, 4096)
		for {
			n, err := hijack.Reader.Read(buf)
			if n > 0 {
				text := string(buf[:n])
				text = strings.ReplaceAll(text, "\r\n", "\n")
				text = strings.TrimRight(text, "\r")
				SendWsJSON(ws, WsMessage{Type: "output", Data: text})
			}
			if err != nil {
				break
			}
		}
	}()

	stdinDone := make(chan struct{})
	go func() {
		defer close(stdinDone)
		for {
			_, rawMsg, err := ws.ReadMessage()
			if err != nil {
				break
			}

			var msg WsMessage
			if err := json.Unmarshal(rawMsg, &msg); err != nil {
				continue
			}

			if msg.Type == "stdin" {
				_, err := hijack.Conn.Write([]byte(msg.Data))
				if err != nil {
					log.Printf("[interactive] stdin write error: %v", err)
					break
				}
			}
		}
	}()

	// Aggressively kill container if timeout is exceeded
	timeoutTimer := time.NewTimer(waitTimeout)
	defer timeoutTimer.Stop()

	go func() {
		<-timeoutTimer.C
		killCtx, killCancel := context.WithTimeout(context.Background(), 2*time.Second)
		e.cli.ContainerKill(killCtx, containerID, "SIGKILL")
		killCancel()
		// Close hijack to unblock reader goroutine
		hijack.Close()
	}()

	// Create a separate context just for waiting with longer deadline
	waitCtx, waitCancel := context.WithTimeout(context.Background(), waitTimeout+5*time.Second)
	defer waitCancel()

	statusCh, errCh := e.cli.ContainerWait(waitCtx, containerID, container.WaitConditionNotRunning)

	var exitCode int
	var wasTimeout bool

	select {
	case status := <-statusCh:
		elapsed := time.Since(start)
		exitCode = int(status.StatusCode)
		if status.Error != nil {
			log.Printf("[interactive] container status error: %v", status.Error)
		}
		// Check if we exceeded timeout (exit code 137 means SIGKILL from timeout)
		if elapsed >= waitTimeout && exitCode == 137 {
			wasTimeout = true
		}
	case err := <-errCh:
		elapsed := time.Since(start)
		if elapsed >= waitTimeout {
			// Timeout definitely occurred
			wasTimeout = true
			exitCode = 137
		} else if err != nil {
			log.Printf("[interactive] container wait error: %v", err)
			exitCode = 1
		}
	case <-time.After(waitTimeout + 3*time.Second):
		// Fallback: forcefully kill if still running after timeout
		killCtx, killCancel := context.WithTimeout(context.Background(), 2*time.Second)
		e.cli.ContainerKill(killCtx, containerID, "SIGKILL")
		killCancel()
		hijack.Close()
		wasTimeout = true
		exitCode = 137
	}

	// Wait for output reader to finish draining
	<-outputDone

	duration := time.Since(start).Milliseconds()
	log.Printf("[interactive] Execution done: exit=%d, duration=%dms, timeout=%v",
		exitCode, duration, wasTimeout)

	// Send exit message
	SendWsJSON(ws, WsMessage{
		Type:       "exit",
		ExitCode:   exitCode,
		DurationMs: duration,
		WasTimeout: wasTimeout,
	})
}

// buildInteractiveCommand creates the shell command without stdin piping.
// Stdin comes from the attached PTY instead.
func buildInteractiveCommand(lang Language, code string) []string {
	switch lang {
	case LangPython:
		script := writeAndExec(code, "main.py", "python3 -u main.py")
		return []string{"/bin/sh", "-c", script}
	case LangGo:
		script := writeAndExec(code, "main.go", "go run main.go")
		return []string{"/bin/sh", "-c", script}
	case LangCpp:
		script := writeAndExec(code, "main.cpp", "g++ -o main main.cpp -std=c++17 && ./main")
		return []string{"/bin/sh", "-c", script}
	case LangRust:
		script := writeAndExec(code, "main.rs", "rustc -o main main.rs && ./main")
		return []string{"/bin/sh", "-c", script}
	case LangJavascript:
		script := writeAndExec(code, "main.js", "node main.js")
		return []string{"/bin/sh", "-c", script}
	default:
		return []string{"/bin/sh", "-c", "echo 'Unsupported language'"}
	}
}

func writeAndExec(code, filename, runCmd string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("cat > %s << 'CODEARENA_EOF'\n", filename))
	sb.WriteString(code)
	if !strings.HasSuffix(code, "\n") {
		sb.WriteString("\n")
	}
	sb.WriteString("CODEARENA_EOF\n")
	sb.WriteString(runCmd)
	return sb.String()
}
