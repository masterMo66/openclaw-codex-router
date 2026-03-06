export type IncomingMessage = {
  chatId: string;
  userId: string;
  text: string;
};

export type ChatRouteMode = "claw" | "codex";

export type ChatRouteState = {
  chatId: string;
  mode: ChatRouteMode;
  sessionId: string | null;
  cwd: string | null;
  updatedAt: number;
  expiresAt: number | null;
};
