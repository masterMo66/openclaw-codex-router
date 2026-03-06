import type { AcpClient } from "../acp/acp-client.js";
import type { RouteStore } from "./route-store.js";

export async function cleanupExpiredSessions(
  store: RouteStore,
  acp: AcpClient,
  now = Date.now(),
): Promise<number> {
  const expired = store.listExpired(now);

  for (const state of expired) {
    if (state.sessionId) {
      try {
        await acp.closeSession(state.sessionId);
      } catch {
        // Swallow close failures so cleanup keeps progressing.
      }
    }

    store.set({
      ...state,
      mode: "claw",
      sessionId: null,
      expiresAt: null,
      updatedAt: now,
    });
  }

  return expired.length;
}
