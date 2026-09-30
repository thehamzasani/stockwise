// src/hooks/useBackup.ts
import { useCallback, useState } from "react";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { save, open } from "@tauri-apps/plugin-dialog";
import { copyFile, readFile, remove, exists } from "@tauri-apps/plugin-fs";
import { format } from "date-fns";
import { getSqlite } from "@/db";
import { AUDIT_EVENTS } from "@/lib/constants";
import { generateId, nowISO } from "@/lib/utils";

const DB_FILE = "stockwise.db";
const LAST_BACKUP_KEY = "stockwise-last-backup";
const PENDING_RESTORE_AUDIT_KEY = "stockwise-pending-restore-audit";
const SQLITE_MAGIC = "SQLite format 3";

export class RestoreError extends Error {
  restartRequired: boolean;
  constructor(message: string, restartRequired: boolean) {
    super(message);
    this.restartRequired = restartRequired;
  }
}

async function getDbPath(): Promise<string> {
  return join(await appConfigDir(), DB_FILE);
}

async function insertAudit(
  eventType: string,
  description: string,
  newValues: Record<string, unknown>
): Promise<void> {
  const sqlite = getSqlite();
  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, old_values, new_values, created_at)
     VALUES (?, ?, 'database', NULL, ?, NULL, ?, ?)`,
    [generateId(), eventType, description, JSON.stringify(newValues), nowISO()]
  );
}

// Flush WAL into the main file so a plain file copy is complete and consistent.
async function checkpointWal(): Promise<void> {
  await getSqlite().select("PRAGMA wal_checkpoint(TRUNCATE)");
}

async function isSqliteFile(path: string): Promise<boolean> {
  const bytes = await readFile(path);
  if (bytes.length < SQLITE_MAGIC.length) return false;
  const header = String.fromCharCode(...bytes.slice(0, SQLITE_MAGIC.length));
  return header === SQLITE_MAGIC;
}

// Call once after the app has started (see App.tsx snippet below).
// The restored DB replaces the old one, so the audit entry is written after reload.
export async function flushPendingRestoreAudit(): Promise<void> {
  try {
    const pending = localStorage.getItem(PENDING_RESTORE_AUDIT_KEY);
    if (!pending) return;
    localStorage.removeItem(PENDING_RESTORE_AUDIT_KEY);
    const info = JSON.parse(pending) as { source: string; restoredAt: string };
    await insertAudit(
      AUDIT_EVENTS.DATABASE_RESTORED,
      `Database restored from ${info.source}`,
      info
    );
  } catch (err) {
    console.error("[StockWise] Failed to write restore audit entry:", err);
  }
}

export function useBackup() {
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() =>
    localStorage.getItem(LAST_BACKUP_KEY)
  );
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Returns the saved file path, or null if the user cancelled the dialog.
  const backupDatabase = useCallback(async (): Promise<string | null> => {
    setIsBackingUp(true);
    try {
      const dbPath = await getDbPath();
      const filePath = await save({
        defaultPath: `stockwise-backup-${format(new Date(), "yyyy-MM-dd_HHmm")}.db`,
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      });
      if (!filePath) return null;

      await checkpointWal();
      await copyFile(dbPath, filePath);

      const now = nowISO();
      localStorage.setItem(LAST_BACKUP_KEY, now);
      setLastBackupTime(now);

      await insertAudit(AUDIT_EVENTS.BACKUP_CREATED, `Database backed up to ${filePath}`, {
        filePath,
        createdAt: now,
      });
      return filePath;
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  // Step 1 of restore: let the user pick a file. SettingsPage then shows ConfirmDialog.
  const pickRestoreFile = useCallback(async (): Promise<string | null> => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "bak"] }],
    });
    if (!selected || Array.isArray(selected)) return null;
    if (!(await isSqliteFile(selected))) {
      throw new Error("That file is not a valid SQLite database.");
    }
    return selected;
  }, []);

  // Step 2 of restore: called only after the user confirms.
  const restoreDatabase = useCallback(async (filePath: string): Promise<void> => {
    setIsRestoring(true);
    let closed = false;
    let safetyPath = "";
    let dbPath = "";
    try {
      dbPath = await getDbPath();
      safetyPath = `${dbPath}.pre-restore.bak`;

      // Safety copy of the current DB so a failed restore can be rolled back.
      await checkpointWal();
      await copyFile(dbPath, safetyPath);

      localStorage.setItem(
        PENDING_RESTORE_AUDIT_KEY,
        JSON.stringify({ source: filePath, restoredAt: nowISO() })
      );

      // Close the connection, then remove stale WAL/SHM files that would
      // otherwise be replayed on top of the restored database.
      await getSqlite().close();
      closed = true;

      for (const suffix of ["-wal", "-shm"]) {
        const sidecar = `${dbPath}${suffix}`;
        if (await exists(sidecar)) await remove(sidecar);
      }

      await copyFile(filePath, dbPath);
      window.location.reload();
    } catch (err) {
      localStorage.removeItem(PENDING_RESTORE_AUDIT_KEY);
      const msg = err instanceof Error ? err.message : String(err);
      if (closed) {
        try {
          await copyFile(safetyPath, dbPath);
        } catch {
          /* rollback failed — surfaced in message below */
        }
        throw new RestoreError(
          `Restore failed: ${msg}. Your previous data was kept. The app will restart.`,
          true
        );
      }
      throw new RestoreError(`Restore failed: ${msg}`, false);
    } finally {
      setIsRestoring(false);
    }
  }, []);

  return {
    lastBackupTime,
    isBackingUp,
    isRestoring,
    backupDatabase,
    pickRestoreFile,
    restoreDatabase,
  };
}