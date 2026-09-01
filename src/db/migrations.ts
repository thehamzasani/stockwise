// src/db/migrations.ts
import type Database from "@tauri-apps/plugin-sql";

const migrationFiles = import.meta.glob<string>("./migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
});

export async function runMigrations(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  const sortedFiles = Object.entries(migrationFiles).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [filePath, sql] of sortedFiles) {
    const name = filePath.split("/").pop()!;

    const existing = await db.select<{ id: number }[]>(
      "SELECT id FROM __drizzle_migrations WHERE name = ?",
      [name]
    );
    if (existing.length > 0) continue;

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.execute(stmt);
    }

    await db.execute(
      "INSERT INTO __drizzle_migrations (name, applied_at) VALUES (?, ?)",
      [name, new Date().toISOString()]
    );

    console.log(`[Migration] Applied: ${name}`);
  }
}