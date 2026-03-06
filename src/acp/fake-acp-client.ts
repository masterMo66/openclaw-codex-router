import type {
  AcpClient,
  EnsureSessionInput,
  EnsureSessionOutput,
  SendMessageInput,
  SendMessageOutput,
} from "./acp-client.js";

type FakeSession = {
  sessionId: string;
  chatId: string;
  cwd: string | null;
  createdAt: number;
  healthy: boolean;
};

export class FakeAcpClient implements AcpClient {
  private readonly sessions = new Map<string, FakeSession>();
  private readonly sessionByChat = new Map<string, string>();

  async ensureSession(input: EnsureSessionInput): Promise<EnsureSessionOutput> {
    const existingId = this.sessionByChat.get(input.chatId);
    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing && existing.healthy) {
        existing.cwd = input.cwd ?? existing.cwd;
        return { sessionId: existing.sessionId };
      }
    }

    const sessionId = `fake-${input.chatId}-${Date.now()}`;
    const session: FakeSession = {
      sessionId,
      chatId: input.chatId,
      cwd: input.cwd ?? null,
      createdAt: Date.now(),
      healthy: true,
    };

    this.sessions.set(sessionId, session);
    this.sessionByChat.set(input.chatId, sessionId);
    return { sessionId };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    const session = this.sessions.get(input.sessionId);
    if (!session || !session.healthy) {
      throw new Error("Session unavailable");
    }

    return {
      text: [
        "[fake codex response]",
        `session: ${session.sessionId}`,
        `cwd: ${session.cwd ?? "unset"}`,
        `message: ${input.text}`,
      ].join("\n"),
    };
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.healthy = false;
    this.sessions.delete(sessionId);

    const mapped = this.sessionByChat.get(session.chatId);
    if (mapped === sessionId) {
      this.sessionByChat.delete(session.chatId);
    }
  }

  async isHealthy(sessionId: string): Promise<boolean> {
    return this.sessions.get(sessionId)?.healthy === true;
  }

  markUnhealthy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.healthy = false;
    }
  }
}
