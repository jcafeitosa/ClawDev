# Plugin Authoring Smoke Example

A ClawDev plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into ClawDev

```bash
pnpm clawdev plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@clawdev/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
