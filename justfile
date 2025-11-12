# Format code with biome
format:
    bun biome format --write .

# Check formatting without making changes
format-check:
    bun biome format .

# Lint code with biome
lint:
    bun biome lint .

# Run tests
test:
    bun test

# Run tests with coverage
test-coverage:
    bun test --coverage

# Run all checks (format, lint, test)
check: format-check lint test

# Fix formatting and linting issues
fix:
    bun biome check --write .

# Run the date header bot (background mode)
run:
    bun run index.ts

# Run the interactive bot (responds to mentions)
bot:
    bun run bot.ts

# Run the bot in dry-run mode
dry-run:
    bun run index.ts --dry-run

# Development watch mode for date headers
dev:
    bun run --watch index.ts

# Development watch mode for interactive bot
dev-bot:
    bun run --watch bot.ts
