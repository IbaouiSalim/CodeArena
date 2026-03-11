package ratelimit

import (
	"testing"
)

func TestAllow_UnderLimit(t *testing.T) {
	l := New(10, 10)
	for i := 0; i < 10; i++ {
		if !l.Allow("192.168.1.1") {
			t.Errorf("request %d should have been allowed", i)
		}
	}
}

func TestAllow_OverLimit(t *testing.T) {
	l := New(1, 5)
	// Use up all 5 burst tokens
	for i := 0; i < 5; i++ {
		if !l.Allow("10.0.0.1") {
			t.Fatalf("request %d should have been allowed (within burst)", i)
		}
	}
	// Next request should be denied
	if l.Allow("10.0.0.1") {
		t.Error("request should have been denied (burst exceeded)")
	}
}

func TestAllow_DifferentIPs(t *testing.T) {
	l := New(1, 2)
	// Exhaust IP1
	l.Allow("ip1")
	l.Allow("ip1")
	if l.Allow("ip1") {
		t.Error("ip1 should be rate limited")
	}
	// IP2 should still be allowed
	if !l.Allow("ip2") {
		t.Error("ip2 should not be rate limited")
	}
}
