# OpenClaw Codex Router

A lightweight OpenClaw plugin that adds reusable Telegram commands for Codex sessions:

- `/codex`
- `/codex <task>`
- `/codex_status`
- `/codex_reset`
- `/backclaw`
- `/backclaw <minutes>`

It is designed for the current OpenClaw Telegram limitation:

- Telegram cannot bind normal messages directly into ACP sub-sessions.
- This plugin solves that by reusing one persistent `acpx codex` session per Telegram chat.
- You keep using `/codex <task>` while the session context is preserved.

## What It Does

- Creates one Codex session per Telegram chat.
- Reuses that session across `/codex <task>` calls.
- Lets you pause usage with `/backclaw`.
- Keeps the session alive for a configurable TTL.
- Shows local Beijing time in `/codex_status`.

## Requirements

- OpenClaw installed and working
- Telegram channel already connected in OpenClaw
- ACPX backend enabled
- `codex` working through OpenClaw ACPX

## Quick Install

Clone the repo, then run:

```bash
./scripts/install.sh
```

That script will:

1. Check `openclaw`
2. Install the plugin into OpenClaw from the current directory
3. Enable the plugin
4. Set default config if missing
5. Restart the OpenClaw gateway

## Default Config

The installer writes this plugin config if it does not already exist:

```json
{
  "plugins": {
    "entries": {
      "codex-router": {
        "enabled": true,
        "config": {
          "defaultCwd": "~/.openclaw/workspace",
          "idleTtlMinutes": 10
        }
      }
    }
  }
}
```

You can later change `idleTtlMinutes` in `~/.openclaw/openclaw.json`.

## Usage

Prepare or reuse the chat session:

```text
/codex
```

Run a task in the persistent Codex session:

```text
/codex 列出当前 workspace 顶层文件
```

Pause usage and keep the session for 10 minutes:

```text
/backclaw
```

Pause usage and keep the session for 1 minute:

```text
/backclaw 1
```

Close immediately:

```text
/backclaw 0
```

Check status:

```text
/codex_status
```

## How Session Reuse Works

- One Telegram private chat maps to one Codex session name.
- The session is reused until one of these happens:
  - `/backclaw 0`
  - `/codex_reset`
  - TTL expires after `/backclaw <minutes>`
  - the underlying ACPX session is gone

## Known Limitation

This plugin does not turn Telegram into a full live Codex chat mode.

OpenClaw Telegram currently does not expose:

- ACP thread binding for Telegram
- a plugin hook to reroute every normal Telegram message into a sub-session

So the supported UX is:

- `/codex <task>` with persistent session reuse

Not:

- `/codex` then all normal messages go to Codex automatically

## Uninstall

```bash
./scripts/uninstall.sh
```

## Repository Layout

- `plugin/index.js`: production plugin
- `openclaw.plugin.json`: plugin manifest
- `scripts/install.sh`: local installer
- `scripts/uninstall.sh`: local uninstaller

The `src/` tree contains earlier scaffold work and can be ignored if you only want the plugin.
