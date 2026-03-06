import type { CodexRouter } from "../router/codex-router.js";
import type { IncomingMessage } from "../types.js";

export type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { id?: number | string };
    text?: string;
  };
};

export type TelegramBotApi = {
  sendMessage(chatId: string, text: string): Promise<void>;
};

export type MainAgentForwarder = {
  handle(message: IncomingMessage): Promise<void>;
};

export async function handleTelegramWebhook(
  update: TelegramUpdate,
  router: CodexRouter,
): Promise<void> {
  const message = parseTelegramMessage(update);
  if (!message) {
    return;
  }

  await router.handle(message);
}

export function createTelegramSendMessage(botApi: TelegramBotApi) {
  return async (chatId: string, text: string): Promise<void> => {
    await botApi.sendMessage(chatId, text);
  };
}

export function createMainAgentForwarder(mainAgent: MainAgentForwarder) {
  return async (message: IncomingMessage): Promise<void> => {
    await mainAgent.handle(message);
  };
}

function parseTelegramMessage(update: TelegramUpdate): IncomingMessage | null {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  const userId = update.message?.from?.id;

  if (!text || chatId === undefined || userId === undefined) {
    return null;
  }

  return {
    chatId: String(chatId),
    userId: String(userId),
    text,
  };
}
