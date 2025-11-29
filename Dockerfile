# ---- BASE ----
FROM node:22-alpine

# Enable corepack pnpm
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /bot

# Copy manifest files first (best for docker cache)
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./

# Install deps
RUN pnpm install --prod

# Copy rest of project
COPY . .

# Start using PM2
CMD ["pnpm", "start"]
