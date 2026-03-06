<h1 align="center">OpenClaw Codex Router</h1>

<p align="center">
  <strong>Reuse one persistent Codex session from Telegram, without touching OpenClaw core.</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-1677ff?style=for-the-badge" alt="MIT License"></a>
  <a href="./openclaw.plugin.json"><img src="https://img.shields.io/badge/OpenClaw-Plugin-111827?style=for-the-badge" alt="OpenClaw Plugin"></a>
  <a href="./scripts/install.sh"><img src="https://img.shields.io/badge/install-one%20command-16a34a?style=for-the-badge" alt="One-command install"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="./README.zh-CN.md">中文</a> ·
  <a href="#what-you-get">What You Get</a> ·
  <a href="#limitations">Limitations</a>
</p>

---

## Why This Exists

If you already use OpenClaw through Telegram, the problem usually is not ACP itself. It is the operator experience.

Typical pain points look like this:

| Pain Point | What Actually Happens |
| --- | --- |
| Codex is technically available | You still need low-level ACP commands to get real work done |
| Telegram feels like the natural UI | But normal Telegram messages cannot bind directly into ACP sub-sessions |
| `/acp spawn`, `/focus`, session keys all exist | Daily use becomes runtime bookkeeping instead of coding |
| You want a stable command surface | But end up remembering implementation details instead of user workflows |

This plugin turns that into a simpler model:

- `/codex`
- `/codex <task>`
- `/codex_status`
- `/codex_reset`
- `/backclaw`
- `/backclaw <minutes>`

The result is practical session reuse for Telegram, while staying inside OpenClaw's current plugin model.

## What You Get

- One persistent Codex session per Telegram chat
- Session reuse across repeated `/codex <task>` calls
- Configurable idle TTL after `/backclaw`
- Status output for session lifecycle and expiry
- Simple install without modifying OpenClaw core

## Quick Start

Clone the repository and run:

```bash
./scripts/install.sh
```

The installer will:

1. Detect `openclaw`
2. Install this repository as a linked OpenClaw plugin
3. Enable the plugin
4. Set default plugin config if missing
5. Restart the OpenClaw gateway

After that, use these commands in Telegram:

```text
/codex
/codex 列出当前 workspace 顶层文件
/codex_status
/backclaw
/backclaw 1
/backclaw 0
```

## Requirements

- OpenClaw is already installed and working
- Telegram is already connected to OpenClaw
- ACPX backend is enabled
- Codex can already run through your OpenClaw ACP setup

## How It Works

This plugin does not replace OpenClaw routing. It wraps it.

- Each Telegram chat maps to one stable Codex session name
- `/codex` creates or reuses that session
- `/codex <task>` runs work inside the same persistent session
- `/backclaw` marks the session for expiry instead of forcing immediate cleanup
- `/backclaw 0` closes it immediately
- `/codex_status` shows current state and expiry

## Session Reuse Rules

The same session is reused until one of these happens:

- `/codex_reset`
- `/backclaw 0`
- idle TTL expires after `/backclaw <minutes>`
- the underlying ACPX session is no longer available

Default idle TTL:

- `10` minutes

You can override it in:

- `~/.openclaw/openclaw.json`

Example:

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

## Limitations

This project deliberately works within current OpenClaw Telegram constraints.

What it supports well:

- `/codex <task>` with persistent session reuse

What it does not claim to support:

- entering a true Telegram-wide Codex mode where every normal message is automatically routed into the Codex sub-session

Why:

- OpenClaw Telegram does not currently expose ACP thread binding for Telegram
- OpenClaw plugins do not currently expose a general hook to reroute all normal Telegram messages into a sub-session

So this repository optimizes for the best workflow that is actually stable today.

## Uninstall

```bash
./scripts/uninstall.sh
```

## Repository Layout

- [plugin/index.js](./plugin/index.js): production plugin
- [openclaw.plugin.json](./openclaw.plugin.json): plugin manifest
- [scripts/install.sh](./scripts/install.sh): installer
- [scripts/uninstall.sh](./scripts/uninstall.sh): uninstaller

The `src/` directory contains earlier scaffold work and is not required for normal plugin use.

## License

[MIT](./LICENSE)
