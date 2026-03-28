---
title: Quick Start
description: Get ClawDev running in under 5 minutes.
---

## Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/paperclipai/paperclip.git
cd paperclip

# Set required env vars
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Start with Docker Compose
docker compose up -d
```

Open `http://localhost:3100` in your browser.

## Local Development

```bash
# Install dependencies
pnpm install

# Start dev server (server + UI)
pnpm dev

# Or start individually
pnpm dev:server  # Backend on port 3100
pnpm dev:svelte  # SvelteKit UI on port 5174
```
