// src/db/transaction.ts
// ─── CRITICAL RULE ────────────────────────────────────────────────────────────
// All reads and writes inside the withTransaction() callback MUST use getSqlite().
// Do NOT call getDb() (Drizzle) inside a transaction callback.
// Drizzle proxy calls are independent HTTP-like calls and do NOT participate in the
// SQLite transaction, even when called inside a withTransaction() block.
//
// CORRECT:  const sqlite = getSqlite(); await sqlite.execute(...)
// WRONG:    const db = getDb(); await db.insert(table).values(...)

import { getSqlite } from "./index";

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const sqlite = getSqlite();
  await sqlite.execute("BEGIN");
  try {
    const result = await fn();
    await sqlite.execute("COMMIT");
    return result;
  } catch (err) {
    try {
      await sqlite.execute("ROLLBACK");
    } catch {
      /* ignore rollback error */
    }
    throw err;
  }
}