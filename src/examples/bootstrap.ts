import {
  CodexRouter,
  FakeAcpClient,
  SqliteRouteStore,
  cleanupExpiredSessions,
} from "../index.js";
import {
  createMainAgentForwarder,
  createTelegramSendMessage,
  handleTelegramWebhook,
  type MainAgentForwarder,
  type TelegramBotApi,
  type TelegramUpdate,
} from "../telegram/webhook-handler.js";

const store = new SqliteRouteStore("./openclaw-router.db");
const acp = new FakeAcpClient();

const telegramBot: TelegramBotApi = {
  async sendMessage(chatId, text) {
    console.log(`[telegram -> ${chatId}] ${text}`);
  },
};

const mainAgent: MainAgentForwarder = {
  async handle(message) {
    console.log(`[main agent] ${message.chatId}: ${message.text}`);
  },
};

const router = new CodexRouter({
  store,
  acp,
  defaultCwd: process.cwd(),
  sendTelegramMessage: createTelegramSendMessage(telegramBot),
  forwardToMainAgent: createMainAgentForwarder(mainAgent),
});

export async function onTelegramUpdate(update: TelegramUpdate): Promise<void> {
  await handleTelegramWebhook(update, router);
}

export async function runCleanupTick(): Promise<void> {
  const cleaned = await cleanupExpiredSessions(store, acp);
  if (cleaned > 0) {
    console.log(`cleaned ${cleaned} expired sessions`);
  }
}
