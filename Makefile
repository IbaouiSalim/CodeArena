.PHONY: all build-backend build-frontend build-images dev test test-backend test-frontend test-e2e lint

all: build-backend build-frontend build-images

build-backend:
	cd backend && CGO_ENABLED=0 go build -o codearena .

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

test: test-backend test-frontend

test-backend:
	cd backend && go test ./... -v

test-frontend:
	cd frontend && npx vitest run

test-e2e:
	cd frontend && npx playwright test

lint:
	cd frontend && npm run lint
	cd frontend && npx prettier --check "src/**/*.{ts,tsx}"

# ── Docker Compose ─────────────────────────────────
up:
	docker compose up --build -d

down:
	docker compose down

# ── Clean ──────────────────────────────────────────
clean:
	rm -f backend/codearena backend/codearena.exe backend/codearena.db
	rm -rf frontend/dist frontend/node_modules
