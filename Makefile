.PHONY: help build run stop logs clean rebuild dev prod install test

# Default target
.DEFAULT_GOAL := help

# Variables
IMAGE_NAME = stitchcraft
CONTAINER_NAME = stitchcraft-app
DEV_PORT = 5173
PROD_PORT = 80

# Help target
help:
	@echo "StitchCraft - Makefile Commands"
	@echo "================================"
	@echo ""
	@echo "Development Commands:"
	@echo "  make install    - Install npm dependencies locally"
	@echo "  make dev        - Run development server locally (npm run dev)"
	@echo "  make build-local- Build the app locally for production"
	@echo ""
	@echo "Docker Commands (Development):"
	@echo "  make build      - Build Docker image for development"
	@echo "  make run        - Run the app in Docker (development mode)"
	@echo "  make stop       - Stop the running container"
	@echo "  make restart    - Restart the container"
	@echo "  make logs       - View container logs"
	@echo "  make shell      - Open shell in running container"
	@echo ""
	@echo "Docker Commands (Production):"
	@echo "  make build-prod - Build Docker image for production"
	@echo "  make run-prod   - Run the app in Docker (production mode)"
	@echo ""
	@echo "Cleanup Commands:"
	@echo "  make clean      - Remove container and image"
	@echo "  make rebuild    - Clean, rebuild and run (development)"
	@echo ""

# Local development commands
install:
	@echo "Installing dependencies..."
	npm install

dev:
	@echo "Starting development server..."
	npm run dev

build-local:
	@echo "Building for production..."
	npm run build

test:
	@echo "Running type check..."
	npx tsc --noEmit

# Docker development commands
build:
	@echo "Building Docker image (development)..."
	docker build --target development -t $(IMAGE_NAME):dev .

run:
	@echo "Running container (development mode)..."
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(CONTAINER_NAME) 2>/dev/null || true
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p $(DEV_PORT):3000 \
		-v $(PWD):/app \
		-v /app/node_modules \
		$(IMAGE_NAME):dev
	@echo ""
	@echo "Container started! Access the app at http://localhost:$(DEV_PORT)"
	@echo "Run 'make logs' to view logs"

# Docker production commands
build-prod:
	@echo "Building Docker image (production)..."
	docker build --target production -t $(IMAGE_NAME):prod .

run-prod:
	@echo "Running container (production mode)..."
	@docker stop $(CONTAINER_NAME)-prod 2>/dev/null || true
	@docker rm $(CONTAINER_NAME)-prod 2>/dev/null || true
	docker run -d \
		--name $(CONTAINER_NAME)-prod \
		-p $(PROD_PORT):80 \
		$(IMAGE_NAME):prod
	@echo ""
	@echo "Container started! Access the app at http://localhost:$(PROD_PORT)"

# Container management
stop:
	@echo "Stopping container..."
	@docker stop $(CONTAINER_NAME) 2>/dev/null || echo "Container not running"
	@docker stop $(CONTAINER_NAME)-prod 2>/dev/null || echo "Production container not running"

restart: stop run

logs:
	@echo "Showing logs (Ctrl+C to exit)..."
	@docker logs -f $(CONTAINER_NAME) 2>/dev/null || docker logs -f $(CONTAINER_NAME)-prod 2>/dev/null || echo "No container running"

shell:
	@echo "Opening shell in container..."
	@docker exec -it $(CONTAINER_NAME) /bin/sh || echo "Container not running. Run 'make run' first."

# Cleanup commands
clean:
	@echo "Cleaning up containers and images..."
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@docker stop $(CONTAINER_NAME)-prod 2>/dev/null || true
	@docker rm $(CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(CONTAINER_NAME)-prod 2>/dev/null || true
	@docker rmi $(IMAGE_NAME):dev 2>/dev/null || true
	@docker rmi $(IMAGE_NAME):prod 2>/dev/null || true
	@echo "Cleanup complete!"

rebuild: clean build run
	@echo "Rebuild complete!"

# Quick start command
quick-start: build run
	@echo ""
	@echo "Quick start complete! The app is now running."
