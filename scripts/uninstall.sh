#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_BIN="${OPENCLAW_BIN:-$(command -v openclaw || true)}"

if [[ -z "${OPENCLAW_BIN}" ]]; then
  echo "openclaw not found in PATH. Set OPENCLAW_BIN to your OpenClaw binary." >&2
  exit 1
fi

"${OPENCLAW_BIN}" plugins uninstall codex-router || true
"${OPENCLAW_BIN}" config unset plugins.entries.codex-router || true
"${OPENCLAW_BIN}" daemon restart

echo "Uninstalled codex-router."
