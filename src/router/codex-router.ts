import type { AcpClient } from "../acp/acp-client.js";
import type { IncomingMessage, ChatRouteState } from "../types.js";
import type { RouteStore } from "./route-store.js";

const DEFAULT_TTL_MS = 20 * 60 * 1000;

export type CodexRouterDeps = {
  store: RouteStore;
  acp: AcpClient;
  sendTelegramMessage: (chatId: string, text: string) => Promise<void>;
  forwardToMainAgent: (message: IncomingMessage) => Promise<void>;
  defaultCwd?: string | null;
  ttlMs?: number;
};

export class CodexRouter {
  private readonly ttlMs: number;
  private readonly defaultCwd: string | null;

  constructor(private readonly deps: CodexRouterDeps) {
    this.ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
    this.defaultCwd = deps.defaultCwd ?? null;
  }

  async handle(message: IncomingMessage): Promise<void> {
    const text = message.text.trim();
    let state = this.deps.store.get(message.chatId);

    if (!state) {
      state = this.newDefaultState(message.chatId);
      this.deps.store.set(state);
    }

    if (text === "/codex") {
      await this.enterCodexMode(state);
      await this.deps.sendTelegramMessage(
        message.chatId,
        "已进入 Codex 模式。后续消息将直接发给代码代理。",
      );
      return;
    }

    if (text === "/backclaw") {
      state.mode = "claw";
      state.updatedAt = Date.now();
      this.deps.store.set(state);
      await this.deps.sendTelegramMessage(message.chatId, "已返回 OpenClaw 模式。");
      return;
    }

    if (text === "/codex_reset") {
      await this.resetCodexSession(state);
      await this.deps.sendTelegramMessage(message.chatId, "Codex 会话已重建。");
      return;
    }

    if (text === "/codex_status") {
      await this.deps.sendTelegramMessage(message.chatId, renderStatus(state));
      return;
    }

    if (text.startsWith("/cwd ")) {
      state.cwd = text.slice(5).trim() || null;
      state.updatedAt = Date.now();
      this.deps.store.set(state);
      await this.deps.sendTelegramMessage(
        message.chatId,
        `cwd 已设置为: ${state.cwd ?? "unset"}`,
      );
      return;
    }

    if (text === "/cwd_clear") {
      state.cwd = null;
      state.updatedAt = Date.now();
      this.deps.store.set(state);
      await this.deps.sendTelegramMessage(message.chatId, "cwd 已清除。");
      return;
    }

    if (state.mode === "codex") {
      await this.forwardToCodex(message, state);
      return;
    }

    await this.deps.forwardToMainAgent(message);
  }

  private newDefaultState(chatId: string): ChatRouteState {
    return {
      chatId,
      mode: "claw",
      sessionId: null,
      cwd: this.defaultCwd,
      updatedAt: Date.now(),
      expiresAt: null,
    };
  }

  private async enterCodexMode(state: ChatRouteState): Promise<void> {
    const session = await this.deps.acp.ensureSession({
      agentId: "codex",
      chatId: state.chatId,
      cwd: state.cwd,
    });

    state.mode = "codex";
    state.sessionId = session.sessionId;
    state.updatedAt = Date.now();
    state.expiresAt = Date.now() + this.ttlMs;
    this.deps.store.set(state);
  }

  private async resetCodexSession(state: ChatRouteState): Promise<void> {
    if (state.sessionId) {
      try {
        await this.deps.acp.closeSession(state.sessionId);
      } catch {
        // Ignore session close failures during reset. The new session matters more.
      }
    }

    const session = await this.deps.acp.ensureSession({
      agentId: "codex",
      chatId: state.chatId,
      cwd: state.cwd,
    });

    state.mode = "codex";
    state.sessionId = session.sessionId;
    state.updatedAt = Date.now();
    state.expiresAt = Date.now() + this.ttlMs;
    this.deps.store.set(state);
  }

  private async forwardToCodex(
    message: IncomingMessage,
    state: ChatRouteState,
  ): Promise<void> {
    try {
      if (!state.sessionId) {
        await this.enterCodexMode(state);
      } else {
        const healthy = await this.deps.acp.isHealthy(state.sessionId);
        if (!healthy) {
          await this.resetCodexSession(state);
        }
      }

      const result = await this.deps.acp.sendMessage({
        sessionId: state.sessionId!,
        text: message.text,
      });

      state.updatedAt = Date.now();
      state.expiresAt = Date.now() + this.ttlMs;
      this.deps.store.set(state);

      await this.deps.sendTelegramMessage(message.chatId, result.text);
    } catch {
      try {
        await this.resetCodexSession(state);
        const retry = await this.deps.acp.sendMessage({
          sessionId: state.sessionId!,
          text: message.text,
        });

        state.updatedAt = Date.now();
        state.expiresAt = Date.now() + this.ttlMs;
        this.deps.store.set(state);

        await this.deps.sendTelegramMessage(message.chatId, retry.text);
      } catch {
        state.mode = "claw";
        state.updatedAt = Date.now();
        this.deps.store.set(state);
        await this.deps.sendTelegramMessage(
          message.chatId,
          "Codex 当前不可用，已切回 OpenClaw 模式。可稍后再试 /codex。",
        );
      }
    }
  }
}

function renderStatus(state: ChatRouteState): string {
  return [
    `mode: ${state.mode}`,
    `sessionId: ${state.sessionId ?? "none"}`,
    `cwd: ${state.cwd ?? "unset"}`,
    `updatedAt: ${new Date(state.updatedAt).toISOString()}`,
    `expiresAt: ${state.expiresAt ? new Date(state.expiresAt).toISOString() : "none"}`,
  ].join("\n");
}
