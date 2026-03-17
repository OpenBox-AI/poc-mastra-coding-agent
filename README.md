# Mastra Coding Agent POC

This project is a proof of concept for a Mastra-powered coding agent that can work inside secure E2B sandboxes and route governance decisions through OpenBox.

It is intended as a runnable demo for:

- sandbox creation and isolated code execution
- file and directory operations
- shell command execution
- OpenBox governance, approvals, and guardrails for agent activity

## Requirements

- Node.js `>=20.9.0`
- an E2B API key
- an OpenAI API key
- an OpenBox Core URL and API key
- the `openbox-mastra-sdk` repository checked out next to this project at `../openbox-mastra-sdk`

The local SDK dependency is currently:

```text
file:../openbox-mastra-sdk
```

If you move the repositories, update `package.json` accordingly.

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required values:

| Variable | Purpose |
| --- | --- |
| `E2B_API_KEY` | access to E2B sandbox execution |
| `OPENAI_API_KEY` | model access for the coding agent |
| `OPENBOX_URL` | OpenBox Core base URL |
| `OPENBOX_API_KEY` | OpenBox API key |

Common runtime options:

| Variable | Purpose | Typical value |
| --- | --- | --- |
| `OPENBOX_GOVERNANCE_POLICY` | behavior when OpenBox is unavailable | `fail_closed` |
| `OPENBOX_VALIDATE` | validate the API key at startup | `true` |
| `OPENBOX_GOVERNANCE_TIMEOUT` | OpenBox API timeout in milliseconds for this demo environment | `5000` |

## Run The Demo

Start the local development server:

```bash
npm run dev
```

This project builds the local `openbox-mastra-sdk` dependency before starting the Mastra dev server.

Other useful commands:

```bash
npm run build
npm run start
```

## What To Try

Example prompts:

- `create a sandbox and write hello_world.txt with print("Hello World")`
- `create a sandbox, write a file, then read it back`
- `create a sandbox and run a shell command`

If OpenBox approvals or guardrails are enabled, the demo will reflect those decisions during agent execution.

## Troubleshooting

### `E2B_API_KEY` is missing or invalid

Check that your runtime is loading `.env.local` and that the key is valid for your E2B account.

### OpenBox requests are failing

Verify:

- `OPENBOX_URL` is reachable from your machine
- `OPENBOX_API_KEY` is correct
- `OPENBOX_VALIDATE` is set appropriately for the environment

### Local SDK changes are not reflected

This project depends on the sibling `openbox-mastra-sdk` repo by local path. Rebuild the SDK and restart the dev server:

```bash
npm --prefix ../openbox-mastra-sdk run build
npm run dev
```

## License

Apache-2.0
