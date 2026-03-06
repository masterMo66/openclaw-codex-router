import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { resolveDefaultTelegramAccountId } from "openclaw/plugin-sdk";

const execFileAsync = promisify(execFile);

const DEFAULT_CWD = "/Users/moqi/.openclaw/workspace";
const DEFAULT_AGENT_ID = "codex";
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_IDLE_TTL_MINUTES = 10;
const DISPLAY_TIME_ZONE = "Asia/Shanghai";
const DISPLAY_TIME_ZONE_LABEL = "北京时间";

let openClawBinPromise;
let acpxBinPromise;

function stripTelegramPrefix(value) {
  return String(value ?? "").replace(/^telegram:/i, "").trim();
}

function parseTelegramTarget(raw) {
  const normalized = stripTelegramPrefix(raw);
  const topicMatch = /^(.+?):topic:(\d+)$/.exec(normalized);
  if (topicMatch) {
    return {
      chatId: topicMatch[1],
      messageThreadId: Number.parseInt(topicMatch[2], 10),
      chatType: topicMatch[1].startsWith("-") ? "group" : "direct",
    };
  }

  const colonMatch = /^(.+):(\d+)$/.exec(normalized);
  if (colonMatch) {
    return {
      chatId: colonMatch[1],
      messageThreadId: Number.parseInt(colonMatch[2], 10),
      chatType: colonMatch[1].startsWith("-") ? "group" : "direct",
    };
  }

  return {
    chatId: normalized,
    chatType: normalized.startsWith("-") ? "group" : "direct",
  };
}

function buildTelegramGroupPeerId(chatId, messageThreadId) {
  return messageThreadId != null ? `${chatId}:topic:${messageThreadId}` : String(chatId);
}

function resolveTelegramDirectPeerId({ chatId, senderId }) {
  const normalizedSenderId = senderId != null ? String(senderId).trim() : "";
  return normalizedSenderId || String(chatId);
}

function buildTelegramParentPeer({ isGroup, resolvedThreadId, chatId }) {
  if (!isGroup || resolvedThreadId == null) return undefined;
  return {
    kind: "group",
    id: String(chatId),
  };
}

function resolveConversation(ctx, api) {
  const accountId = ctx.accountId?.trim() || resolveDefaultTelegramAccountId(ctx.config) || "default";
  const target = parseTelegramTarget(ctx.to || ctx.from || "");
  const isGroup = target.chatType === "group";
  const resolvedThreadId = isGroup ? target.messageThreadId ?? ctx.messageThreadId : undefined;
  const peer = {
    kind: isGroup ? "group" : "direct",
    id: isGroup
      ? buildTelegramGroupPeerId(target.chatId, resolvedThreadId)
      : resolveTelegramDirectPeerId({ chatId: target.chatId, senderId: ctx.senderId }),
  };
  const parentPeer = buildTelegramParentPeer({
    isGroup,
    resolvedThreadId,
    chatId: target.chatId,
  });
  const route = api.runtime.channel.routing.resolveAgentRoute({
    cfg: ctx.config,
    channel: "telegram",
    accountId,
    peer,
    parentPeer,
  });

  return {
    accountId,
    route,
    chatId: target.chatId,
    messageThreadId: resolvedThreadId,
    target,
  };
}

function sanitizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildSessionName(conversation) {
  const parts = ["telegram", conversation.chatId];
  if (conversation.messageThreadId != null) parts.push(`topic-${conversation.messageThreadId}`);
  return sanitizeName(parts.join("-")) || "telegram";
}

function parseTtlMinutesArg(raw, fallbackMinutes) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return fallbackMinutes;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("TTL 参数必须是大于等于 0 的分钟数，例如 /backclaw 10");
  }
  return value;
}

function resolveCommandArgs(ctx, commandName) {
  const direct = String(ctx?.args ?? "").trim();
  if (direct) return direct;

  const body = String(ctx?.commandBody ?? "").trim();
  if (!body) return "";

  const re = new RegExp(`^/${commandName}(?:\\s+|\\s*:\\s*)(.*)$`, "i");
  const match = re.exec(body);
  return match?.[1]?.trim() ?? "";
}

function formatLocalTime(valueMs) {
  if (!Number.isFinite(valueMs)) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(valueMs));
}

function formatRemainingMs(valueMs) {
  const diff = Math.max(0, Math.round((valueMs - Date.now()) / 1000));
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  if (minutes > 0) return seconds === 0 ? `${minutes}m` : `${minutes}m`;
  return `${seconds}s`;
}

function formatTimestampString(value) {
  const ts = Date.parse(String(value ?? ""));
  if (!Number.isFinite(ts)) return String(value ?? "");
  return `${formatLocalTime(ts)} (${DISPLAY_TIME_ZONE_LABEL})`;
}

function localizeSessionDetails(details) {
  return String(details ?? "")
    .split("\n")
    .map((line) => {
      const match = /^(\w+):\s+(.+)$/.exec(line);
      if (!match) return line;
      const [, key, value] = match;
      if (value.trim() === "-" || value.trim().toLowerCase() === "no") return line;
      if (!/(created|lastActivity|lastPrompt|closedAt|agentStartedAt|lastExitAt)$/i.test(key)) return line;
      return `${key}: ${formatTimestampString(value.trim())}`;
    })
    .join("\n");
}

async function resolveOpenClawBin() {
  if (!openClawBinPromise) {
    openClawBinPromise = (async () => {
      const candidates = [
        process.env.OPENCLAW_BIN?.trim(),
        path.join(path.dirname(process.execPath), "openclaw"),
        process.argv[1] && path.basename(process.argv[1]) === "openclaw" ? process.argv[1] : "",
        "/Users/moqi/.nvm/versions/node/v22.22.0/bin/openclaw",
      ].filter(Boolean);

      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          return candidate;
        } catch {}
      }

      throw new Error(`Unable to resolve openclaw binary. Tried: ${candidates.join(", ")}`);
    })();
  }

  return openClawBinPromise;
}

async function resolveAcpxBin() {
  if (!acpxBinPromise) {
    acpxBinPromise = (async () => {
      const openclawBin = await resolveOpenClawBin();
      const candidates = [
        process.env.ACPX_BIN?.trim(),
        path.resolve(path.dirname(openclawBin), "../lib/node_modules/openclaw/extensions/acpx/node_modules/.bin/acpx"),
        "/Users/moqi/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/extensions/acpx/node_modules/.bin/acpx",
      ].filter(Boolean);

      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          return candidate;
        } catch {}
      }

      throw new Error(`Unable to resolve acpx binary. Tried: ${candidates.join(", ")}`);
    })();
  }

  return acpxBinPromise;
}

function cleanAcpxOutput(raw) {
  return String(raw ?? "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\[(acpx|client|done)\]/.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function resolveStateFile(api) {
  return path.join(api.runtime.state.resolveStateDir(), "plugins", api.id, "state.json");
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readState(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { conversations: {} };
    }
    throw error;
  }
}

async function writeState(filePath, state) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2));
}

async function updateState(filePath, mutate) {
  const state = await readState(filePath);
  const next = (await mutate(state)) ?? state;
  await writeState(filePath, next);
  return next;
}

async function runAcpx(args, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const acpxBin = await resolveAcpxBin();
  const { stdout, stderr } = await execFileAsync(acpxBin, args, {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 16,
  });

  return {
    stdout: String(stdout ?? ""),
    stderr: String(stderr ?? ""),
  };
}

async function ensureSession({ cwd, sessionName }) {
  await runAcpx(["--cwd", cwd, DEFAULT_AGENT_ID, "sessions", "ensure", "--name", sessionName], 60_000);
}

async function closeSession({ cwd, sessionName }) {
  try {
    await runAcpx(["--cwd", cwd, DEFAULT_AGENT_ID, "sessions", "close", sessionName], 60_000);
    return true;
  } catch (error) {
    const text = String(error?.stdout ?? error?.stderr ?? error?.message ?? error);
    if (/not found|no session/i.test(text)) return false;
    throw error;
  }
}

async function showSession({ cwd, sessionName }) {
  try {
    const { stdout } = await runAcpx(["--cwd", cwd, DEFAULT_AGENT_ID, "sessions", "show", sessionName], 30_000);
    return cleanAcpxOutput(stdout);
  } catch (error) {
    const text = String(error?.stdout ?? error?.stderr ?? error?.message ?? error);
    if (/not found|no session/i.test(text)) return "";
    throw error;
  }
}

function isClosedSessionDetails(details) {
  return /(?:^|\n)closed:\s*yes(?:\n|$)/i.test(String(details ?? ""));
}

async function promptSession({ cwd, sessionName, prompt }) {
  const { stdout, stderr } = await runAcpx(
    [
      "--approve-all",
      "--cwd",
      cwd,
      "--format",
      "quiet",
      DEFAULT_AGENT_ID,
      "prompt",
      "-s",
      sessionName,
      prompt,
    ],
    DEFAULT_TIMEOUT_MS,
  );

  return cleanAcpxOutput(stdout || stderr);
}

function createPlugin() {
  return {
    id: "codex-router",
    name: "Codex Router",
    description: "Adds Telegram-friendly Codex commands backed by acpx sessions.",
    register(api) {
      const configuredCwd = typeof api.pluginConfig?.defaultCwd === "string" ? api.pluginConfig.defaultCwd.trim() : "";
      const idleTtlMinutes = Number.isFinite(Number(api.pluginConfig?.idleTtlMinutes))
        ? Math.max(0, Number(api.pluginConfig.idleTtlMinutes))
        : DEFAULT_IDLE_TTL_MINUTES;
      const stateFile = resolveStateFile(api);

      function resolveRuntimeConfig(ctx) {
        const conversation = resolveConversation(ctx, api);
        const cwd = configuredCwd || DEFAULT_CWD;
        const sessionName = buildSessionName(conversation);
        return { conversation, cwd, sessionName };
      }

      async function clearPendingClose(sessionName) {
        await updateState(stateFile, (draft) => {
          if (!draft.conversations) draft.conversations = {};
          delete draft.conversations[sessionName];
          return draft;
        });
      }

      async function cleanupExpiredSessions() {
        const state = await readState(stateFile);
        const entries = Object.entries(state.conversations ?? {});
        if (entries.length === 0) return;

        const now = Date.now();
        for (const [sessionName, record] of entries) {
          const closeAfterMs = Number(record?.closeAfterMs ?? 0);
          const cwd = typeof record?.cwd === "string" && record.cwd.trim() ? record.cwd.trim() : configuredCwd || DEFAULT_CWD;
          if (!closeAfterMs || closeAfterMs > now) continue;

          try {
            await closeSession({ cwd, sessionName });
          } catch (error) {
            api.logger.warn(
              `[codex-router] failed to close expired session ${sessionName}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }

          await updateState(stateFile, (draft) => {
            delete draft.conversations?.[sessionName];
            return draft;
          });
        }
      }

      api.registerCommand({
        name: "codex",
        description: "Run a task through a persistent Codex acpx session for this Telegram chat",
        acceptsArgs: true,
        handler: async (ctx) => {
          try {
            if (ctx.channel !== "telegram") {
              return { text: "⚠️ /codex 目前只支持 Telegram 对话。" };
            }

            const { cwd, sessionName } = resolveRuntimeConfig(ctx);
            const prompt = resolveCommandArgs(ctx, "codex");

            await cleanupExpiredSessions();
            await ensureSession({ cwd, sessionName });
            await clearPendingClose(sessionName);

            if (!prompt) {
              return {
                text: [
                  "已准备 Codex 会话。",
                  "Telegram 当前不支持把普通消息直接绑定到 ACP 子会话，所以请用：",
                  "/codex 你的任务",
                  "后续仍会复用同一个 Codex 持久会话。",
                  `session: ${sessionName}`,
                  `cwd: ${cwd}`,
                ].join("\n"),
              };
            }

            const output = await promptSession({ cwd, sessionName, prompt });
            return {
              text: output || "Codex 已执行，但没有返回可显示文本。",
            };
          } catch (error) {
            api.logger.error(`[codex-router] /codex failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            return { text: `⚠️ /codex 失败：${error instanceof Error ? error.message : String(error)}` };
          }
        },
      });

      api.registerCommand({
        name: "backclaw",
        description: "Close the Telegram chat's Codex acpx session",
        acceptsArgs: true,
        handler: async (ctx) => {
          try {
            if (ctx.channel !== "telegram") {
              return { text: "⚠️ /backclaw 目前只支持 Telegram 对话。" };
            }

            const { cwd, sessionName } = resolveRuntimeConfig(ctx);
            const rawArgs = resolveCommandArgs(ctx, "backclaw");
            const requestedTtlMinutes = parseTtlMinutesArg(rawArgs, idleTtlMinutes);
            const requestedTtlMs = Math.round(requestedTtlMinutes * 60_000);
            api.logger.info(
              `[codex-router] /backclaw parsed ttl=${requestedTtlMinutes} rawArgs=${JSON.stringify(rawArgs)} ctx.args=${JSON.stringify(ctx.args ?? "")} commandBody=${JSON.stringify(ctx.commandBody ?? "")}`,
            );
            await cleanupExpiredSessions();
            const details = await showSession({ cwd, sessionName });
            if (!details) {
              await clearPendingClose(sessionName);
              return { text: "当前没有活动的 Codex 会话。" };
            }

            if (requestedTtlMs <= 0) {
              await closeSession({ cwd, sessionName });
              await clearPendingClose(sessionName);
              return { text: "已关闭当前 Telegram 对话的 Codex 会话。" };
            }

            await updateState(stateFile, (draft) => {
              if (!draft.conversations) draft.conversations = {};
              draft.conversations[sessionName] = {
                sessionName,
                cwd,
                closeAfterMs: Date.now() + requestedTtlMs,
              };
              return draft;
            });
            return {
              text: `已退出 Codex 使用态。当前会话将保留 ${requestedTtlMinutes} 分钟；在此期间再次 /codex 会继续复用，超时后自动关闭。`,
            };
          } catch (error) {
            api.logger.error(`[codex-router] /backclaw failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            return { text: `⚠️ /backclaw 失败：${error instanceof Error ? error.message : String(error)}` };
          }
        },
      });

      api.registerCommand({
        name: "codex_status",
        description: "Show the Telegram chat's Codex acpx session status",
        handler: async (ctx) => {
          try {
            if (ctx.channel !== "telegram") {
              return { text: "⚠️ /codex_status 目前只支持 Telegram 对话。" };
            }

            const { cwd, sessionName } = resolveRuntimeConfig(ctx);
            await cleanupExpiredSessions();
            const details = await showSession({ cwd, sessionName });
            if (!details || isClosedSessionDetails(details)) {
              await clearPendingClose(sessionName);
              return { text: "mode: claw" };
            }
            const localizedDetails = localizeSessionDetails(details);

            const state = await readState(stateFile);
            const pending = state.conversations?.[sessionName];
            return {
              text: [
                pending?.closeAfterMs ? "mode: claw" : "mode: codex",
                `session: ${sessionName}`,
                `cwd: ${cwd}`,
                pending?.closeAfterMs ? `autoCloseAt: ${formatLocalTime(pending.closeAfterMs)} (${DISPLAY_TIME_ZONE_LABEL})` : null,
                pending?.closeAfterMs ? `remaining: ${formatRemainingMs(pending.closeAfterMs)}` : null,
                localizedDetails,
              ]
                .filter(Boolean)
                .join("\n"),
            };
          } catch (error) {
            api.logger.error(`[codex-router] /codex_status failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            return { text: `⚠️ /codex_status 失败：${error instanceof Error ? error.message : String(error)}` };
          }
        },
      });

      api.registerCommand({
        name: "codex_reset",
        description: "Reset the Telegram chat's Codex acpx session",
        handler: async (ctx) => {
          try {
            if (ctx.channel !== "telegram") {
              return { text: "⚠️ /codex_reset 目前只支持 Telegram 对话。" };
            }

            const { cwd, sessionName } = resolveRuntimeConfig(ctx);
            await cleanupExpiredSessions();
            await closeSession({ cwd, sessionName }).catch(() => false);
            await ensureSession({ cwd, sessionName });
            await clearPendingClose(sessionName);
            return {
              text: [
                "Codex 会话已重建。",
                `session: ${sessionName}`,
                `cwd: ${cwd}`,
              ].join("\n"),
            };
          } catch (error) {
            api.logger.error(`[codex-router] /codex_reset failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            return { text: `⚠️ /codex_reset 失败：${error instanceof Error ? error.message : String(error)}` };
          }
        },
      });
    },
  };
}

export default createPlugin();
