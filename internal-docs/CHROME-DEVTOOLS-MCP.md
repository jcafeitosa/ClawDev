# Chrome DevTools MCP Setup

This repo does not bundle a Chrome MCP connector, but it now includes a small helper to launch Chrome in remote-debugging mode so you can connect the Chrome DevTools MCP server from your local MCP client.

The repo launch config now also includes a `chrome-devtools` entry in [.claude/launch.json](/Users/juliocezaraquinofeitosa/Development/clawdev/.claude/launch.json), so the same helper can be started alongside the API/UI services.

## 1. Start Chrome with remote debugging

Use the helper script:

```sh
pnpm chrome:debug
```

Or start the `chrome-devtools` launch configuration if your toolchain reads `.claude/launch.json`.

By default this starts Chrome with:

- debugging port `9222`
- an isolated temporary profile directory

Environment overrides:

```sh
CHROME_DEBUG_PORT=9222 CHROME_USER_DATA_DIR=/tmp/clawdev-chrome pnpm chrome:debug
```

If your system Chrome binary is in a non-standard path, set:

```sh
CHROME_DEBUG_BINARY="/path/to/Google Chrome" pnpm chrome:debug
```

## 2. Add Chrome DevTools MCP to your client

Use the official Chrome DevTools MCP config:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

If you want the MCP server to attach to the Chrome instance started by `pnpm chrome:debug`, use the browser URL form:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222"
      ]
    }
  }
}
```

## 3. Recommended test flow

1. Start the app with `pnpm dev`.
2. Start Chrome with `pnpm chrome:debug`.
3. Attach your MCP client to Chrome DevTools MCP.
4. Test pages directly in the live browser:
   - `/setup`
   - `/[companyPrefix]/dashboard`
   - `/[companyPrefix]/inbox`
   - `/[companyPrefix]/agents/:agentId`
   - `/[companyPrefix]/runs/:runId`

## 4. Why this is the closest-to-user setup

This uses a real Chrome instance and a live profile instead of a headless sandbox browser, so it is the closest match to what a user sees in practice.
