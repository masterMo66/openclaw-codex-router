export type EnsureSessionInput = {
  agentId: string;
  chatId: string;
  cwd?: string | null;
};

export type EnsureSessionOutput = {
  sessionId: string;
};

export type SendMessageInput = {
  sessionId: string;
  text: string;
};

export type SendMessageOutput = {
  text: string;
};

export interface AcpClient {
  ensureSession(input: EnsureSessionInput): Promise<EnsureSessionOutput>;
  sendMessage(input: SendMessageInput): Promise<SendMessageOutput>;
  closeSession(sessionId: string): Promise<void>;
  isHealthy(sessionId: string): Promise<boolean>;
}
