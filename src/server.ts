import { createServer } from "node:http";

import { onTelegramUpdate, runCleanupTick } from "./examples/bootstrap.js";
import type { TelegramUpdate } from "./telegram/webhook-handler.js";

const port = Number(process.env.PORT ?? "3000");
const cleanupIntervalMs = Number(process.env.CLEANUP_INTERVAL_MS ?? `${5 * 60 * 1000}`);

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/telegram/webhook") {
    try {
      const body = (await readJson(req)) as TelegramUpdate;
      await onTelegramUpdate(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : "unknown_error",
        }),
      );
      return;
    }
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

server.listen(port, () => {
  console.log(`server listening on http://127.0.0.1:${port}`);
});

setInterval(() => {
  void runCleanupTick();
}, cleanupIntervalMs);

async function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}
