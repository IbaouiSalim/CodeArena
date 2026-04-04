package ratelimit

import (
	"net/http"
	"sync"
	"time"
)

type visitor struct {
	tokens   float64
	lastSeen time.Time
}

type Limiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     float64
	burst    int
}

func New(rate float64, burst int) *Limiter {
	l := &Limiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		burst:    burst,
	}
	go l.cleanup()
	return l
}

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
		return false
	}

	v.tokens--
	return true
}

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

func (l *Limiter) cleanup() {
	for {
		time.Sleep(time.Minute)
		l.mu.Lock()

		for ip, v := range l.visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(l.visitors, ip)
			}
		}

		l.mu.Unlock()
	}
}
