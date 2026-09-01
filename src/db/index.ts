// src/db/index.ts
// initDb(sqlite) receives the already-loaded Database instance from main.tsx.
// It does NOT call Database.load() itself.
// It sets PRAGMA foreign_keys = ON and runs integrity_check here,
// since PRAGMAs must be set on every connection — not just in migrations.

import { drizzle } from "drizzle-orm/sqlite-proxy";
import type Database from "@tauri-apps/plugin-sql";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database | null = null;

export function getSqlite(): Database {
  if (!_sqlite) throw new Error("Database not initialized. Call initDb(sqlite) first.");
  return _sqlite;
}

function isSelectQuery(sql: string): boolean {
  const t = sql.trim().toLowerCase();
  return t.startsWith("select") || t.startsWith("pragma");
}

export async function initDb(sqlite: Database): Promise<void> {
  _sqlite = sqlite;

  // Set on every connection — migrations only run once, PRAGMAs reset each session
  await sqlite.execute("PRAGMA foreign_keys = ON");

  // Detect corruption early — before the UI renders
  const check = await sqlite.select<{ integrity_check: string }[]>(
    "PRAGMA integrity_check"
  );
  if (check[0]?.integrity_check !== "ok") {
    throw new Error(
      "Database integrity check failed. Please restore from a backup via Settings → Data Management."
    );
  }

_db = drizzle<typeof schema>(
  async (sql, params, method) => {
    if (!_sqlite) throw new Error("Database not initialized.");
    try {
      if (isSelectQuery(sql)) {
        const rows = await _sqlite.select(sql, params as unknown[]) as Record<string, unknown>[];
        return {
          rows: method === "all"
            ? rows.map((r) => Object.values(r))
            : rows.length > 0
              ? [Object.values(rows[0])]
              : [],
        };
      } else {
        await _sqlite.execute(sql, params as unknown[]);
        return { rows: [] };
      }
    } catch (err) {
      console.error("[StockWise DB Error]", sql, params, err);
      throw err;
    }
  },
  { schema, logger: import.meta.env.DEV }
);
}

export function getDb() {
  if (!_db) throw new Error("Database not initialized. Call initDb(sqlite) first.");
  return _db;
}