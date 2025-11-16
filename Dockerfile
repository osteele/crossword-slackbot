# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy application code
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .

# Expose port (Fly.io will bind to this)
EXPOSE 3000

# Run the bot (interactive mode)
CMD ["bun", "run", "bot.ts"]
