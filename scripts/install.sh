#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_BIN="${OPENCLAW_BIN:-$(command -v openclaw || true)}"

if [[ -z "${OPENCLAW_BIN}" ]]; then
  echo "openclaw not found in PATH. Set OPENCLAW_BIN to your OpenClaw binary." >&2
  exit 1
fi

echo "Using OpenClaw: ${OPENCLAW_BIN}"
echo "Installing plugin from: ${ROOT_DIR}"

"${OPENCLAW_BIN}" plugins install --link "${ROOT_DIR}"
"${OPENCLAW_BIN}" config set plugins.entries.codex-router.enabled true

if ! "${OPENCLAW_BIN}" config get plugins.entries.codex-router.config.defaultCwd >/dev/null 2>&1; then
  "${OPENCLAW_BIN}" config set plugins.entries.codex-router.config.defaultCwd "${HOME}/.openclaw/workspace"
fi

if ! "${OPENCLAW_BIN}" config get plugins.entries.codex-router.config.idleTtlMinutes >/dev/null 2>&1; then
  "${OPENCLAW_BIN}" config set plugins.entries.codex-router.config.idleTtlMinutes 10
fi

"${OPENCLAW_BIN}" daemon restart

echo
echo "Installed. Try these in Telegram:"
echo "  /codex"
echo "  /codex_status"
echo "  /codex 列出当前 workspace 顶层文件"
