FROM oven/bun:1-trixie AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY svelte-ui/package.json svelte-ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/gemini-local/package.json packages/adapters/gemini-local/
COPY packages/adapters/openclaw-gateway/package.json packages/adapters/openclaw-gateway/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/
COPY packages/adapters/copilot-local/package.json packages/adapters/copilot-local/
COPY packages/adapters/embedding-local/package.json packages/adapters/embedding-local/
COPY packages/plugins/sdk/package.json packages/plugins/sdk/
COPY patches/ patches/

RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @clawdev/svelte-ui build
RUN pnpm --filter @clawdev/plugin-sdk build
RUN pnpm --filter @clawdev/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --chown=bun:bun --from=build /app /app
RUN bun add --global @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai \
  && mkdir -p /clawdev \
  && chown bun:bun /clawdev

ENV NODE_ENV=production \
  HOME=/clawdev \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  CLAWDEV_HOME=/clawdev \
  CLAWDEV_INSTANCE_ID=default \
  CLAWDEV_CONFIG=/clawdev/instances/default/config.json \
  CLAWDEV_DEPLOYMENT_MODE=authenticated \
  CLAWDEV_DEPLOYMENT_EXPOSURE=private

VOLUME ["/clawdev"]
EXPOSE 3100

USER bun
CMD ["bun", "server/dist/index.js"]
