.PHONY: help all build-backend build-frontend build-images dev test test-backend test-frontend test-e2e lint format format-check clean up down logs firewall-check

help:
	@echo "Makefile targets:"
	@echo ""
	@echo "Build:"
	@echo "  make all              build everything"
	@echo "  make build-backend    build Go backend"
	@echo "  make build-frontend   build React frontend"
	@echo "  make build-images     build Docker compiler images"
	@echo ""
	@echo "Development:"
	@echo "  make dev              start backend and frontend"
	@echo ""
	@echo "Testing:"
	@echo "  make test             run all tests"
	@echo "  make test-backend     run Go tests"
	@echo "  make test-frontend    run React tests"
	@echo "  make test-e2e         run E2E tests"
	@echo ""
	@echo "Code:"
	@echo "  make lint             lint code"
	@echo "  make format           format code"
	@echo "  make format-check     check formatting"
	@echo ""
	@echo "Docker:"
	@echo "  make up               start services"
	@echo "  make down             stop services"
	@echo "  make logs             view logs"
	@echo ""
	@echo "Verify:"
	@echo "  make firewall-check   verify firewall rules and ports"
	@echo ""
	@echo "Clean:"
	@echo "  make clean            remove build files"
	@echo ""

all: build-backend build-frontend build-images

build-backend:
	cd backend && set CGO_ENABLED=0 && go build -o codearena .

build-frontend:
	cd frontend && npm ci && npm run build

build-images:
	docker build -t codearena-python -f infra/docker/python.Dockerfile infra/docker
	docker build -t codearena-go -f infra/docker/go.Dockerfile infra/docker
	docker build -t codearena-cpp -f infra/docker/cpp.Dockerfile infra/docker
	docker build -t codearena-rust -f infra/docker/rust.Dockerfile infra/docker
	docker build -t codearena-javascript -f infra/docker/javascript.Dockerfile infra/docker

dev:
	cd backend && go run . &
	cd frontend && npm run dev

test: test-backend test-frontend test-e2e

test-backend:
	cd backend && go test ./... -v

test-frontend:
	cd frontend && npx vitest run

test-e2e:
	cd frontend && npx playwright test

lint:
	cd frontend && npm run lint

format:
	cd frontend && npm run format

format-check:
	cd frontend && npm run format:check

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	@powershell -Command "$$ErrorActionPreference='SilentlyContinue'; Write-Host 'Cleaning up...'; Remove-Item 'backend/codearena', 'backend/codearena.exe', 'backend/codearena.db', 'frontend/dist', 'frontend/node_modules' -Recurse -Force 2>&1 | Out-Null; Write-Host 'Cleaned backend and frontend'; exit 0"

firewall-check:
	@echo "=== Checking Firewall Rules ==="
	@powershell -Command "Get-NetFirewallRule -DisplayName 'CodeArena*' -ErrorAction SilentlyContinue | Select-Object DisplayName, Direction, Action, Enabled | Format-Table -AutoSize"
	@echo ""
	@echo "=== Checking Listening Ports ==="
	@powershell -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$$_.LocalPort -eq 5173 -or $$_.LocalPort -eq 8080} | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize"
	@echo ""
	@echo "✓ Firewall verification complete"
