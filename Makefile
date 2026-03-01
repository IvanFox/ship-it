.PHONY: install dev build lint fix-lint test help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'

install: ## Install dependencies and build the extension for Raycast
	npm ci
	npm run build

dev: ## Start dev mode with hot-reload
	npm run dev

build: ## Production build
	npm run build

lint: ## Run linter
	npm run lint

fix-lint: ## Auto-fix lint issues
	npm run fix-lint

test: ## Run tests
	npm run test
