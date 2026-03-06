import Database from "better-sqlite3";

import type { ChatRouteState } from "../types.js";

export interface RouteStore {
  get(chatId: string): ChatRouteState | null;
  set(state: ChatRouteState): void;
  delete(chatId: string): void;
  listExpired(now: number): ChatRouteState[];
}

export class SqliteRouteStore implements RouteStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_routes (
        chat_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        session_id TEXT,
        cwd TEXT,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_chat_routes_expires_at
      ON chat_routes (expires_at);
    `);
  }

  get(chatId: string): ChatRouteState | null {
    const row = this.db
      .prepare(
        `SELECT chat_id, mode, session_id, cwd, updated_at, expires_at
         FROM chat_routes
         WHERE chat_id = ?`,
      )
      .get(chatId) as Row | undefined;

    return row ? mapRow(row) : null;
  }

  set(state: ChatRouteState): void {
    this.db
      .prepare(
        `INSERT INTO chat_routes (chat_id, mode, session_id, cwd, updated_at, expires_at)
         VALUES (@chatId, @mode, @sessionId, @cwd, @updatedAt, @expiresAt)
         ON CONFLICT(chat_id) DO UPDATE SET
           mode = excluded.mode,
           session_id = excluded.sessionId,
           cwd = excluded.cwd,
           updated_at = excluded.updatedAt,
           expires_at = excluded.expiresAt`,
      )
      .run(state);
  }

  delete(chatId: string): void {
    this.db.prepare(`DELETE FROM chat_routes WHERE chat_id = ?`).run(chatId);
  }

  listExpired(now: number): ChatRouteState[] {
    const rows = this.db
      .prepare(
        `SELECT chat_id, mode, session_id, cwd, updated_at, expires_at
         FROM chat_routes
         WHERE expires_at IS NOT NULL
           AND expires_at <= ?`,
      )
      .all(now) as Row[];

    return rows.map(mapRow);
  }
}

type Row = {
  chat_id: string;
  mode: ChatRouteState["mode"];
  session_id: string | null;
  cwd: string | null;
  updated_at: number;
  expires_at: number | null;
};

function mapRow(row: Row): ChatRouteState {
  return {
    chatId: row.chat_id,
    mode: row.mode,
    sessionId: row.session_id,
    cwd: row.cwd,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}
