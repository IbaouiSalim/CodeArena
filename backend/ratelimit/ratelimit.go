package ratelimit

import (
	"net/http"
	"sync"
	"time"
)

// visitor tracks rate limit tokens for an IP address
type visitor struct {
	tokens   float64
	lastSeen time.Time
}

// Limiter implements IP-based rate limiting using a token bucket algorithm
type Limiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     float64
	burst    int
}

// New creates a rate limiter with specified rate (tokens/sec) and burst size
func New(rate float64, burst int) *Limiter {
	l := &Limiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		burst:    burst,
	}

	go l.cleanup()
	return l
}

// Allow checks if an IP address is allowed to make a request
func (l *Limiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	v, exists := l.visitors[ip]
	now := time.Now()

	if !exists {

		l.visitors[ip] = &visitor{
			tokens:   float64(l.burst) - 1,
			lastSeen: now,
		}
		return true
	}

	elapsed := now.Sub(v.lastSeen).Seconds()

	v.tokens += elapsed * l.rate

	if v.tokens > float64(l.burst) {
		v.tokens = float64(l.burst)
	}

	v.lastSeen = now

	if v.tokens < 1 {
		// Rate limit exceeded
		return false
	}

	v.tokens--
	return true
}

// Middleware returns an HTTP middleware function that enforces rate limiting
func (l *Limiter) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		ip := r.RemoteAddr

		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			ip = xff
		}

		if !l.Allow(ip) {

			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}

		next(w, r)
	}
}

// cleanup periodically removes stale visitor entries (not seen in 10 minutes)
func (l *Limiter) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		l.mu.Lock()

		now := time.Now()

		for ip, v := range l.visitors {
			if now.Sub(v.lastSeen) > 10*time.Minute {
				delete(l.visitors, ip)
			}
		}

		l.mu.Unlock()
	}
}
