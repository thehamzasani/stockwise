// src/components/settings/DataManagementSection.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog  from "@/components/shared/ConfirmDialog";
import { useBackup, RestoreError } from "@/hooks/useBackup";
import { formatRelativeTime } from "@/lib/utils";

export function DataManagementSection() {
  const {
    lastBackupTime,
    isBackingUp,
    isRestoring,
    backupDatabase,
    pickRestoreFile,
    restoreDatabase,
  } = useBackup();

  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null);

  async function handleBackup() {
    try {
      const path = await backupDatabase();
      if (path) toast.success("Backup saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    }
  }

  async function handlePickRestore() {
    try {
      const path = await pickRestoreFile();
      if (path) setPendingRestorePath(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open file");
    }
  }

  async function handleConfirmRestore() {
    if (!pendingRestorePath) return;
    const path = pendingRestorePath;
    setPendingRestorePath(null);
    try {
      await restoreDatabase(path); // reloads the app on success
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
      if (err instanceof RestoreError && err.restartRequired) {
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  }

  return (
    <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide">
          Data Management
        </h2>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#111827]">Backup Database</p>
            <p className="text-sm text-[#6b7280]">
              {lastBackupTime
                ? `Last backup: ${formatRelativeTime(lastBackupTime)}`
                : "No backup has been made yet"
                }
            </p>
          </div>
          <Button
            onClick={handleBackup}
            disabled={isBackingUp || isRestoring}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] h-9 px-4 text-sm font-medium"
          >
            <Download className="mr-2 h-4 w-4" />
            {isBackingUp ? "Backing up…" : "Backup Database"}
          </Button>
        </div>

        <div className="border-t border-[#e4e7ec] pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#111827]">Restore from Backup</p>
              <p className="flex items-center gap-1.5 text-sm text-[#d97706]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Restore replaces ALL current data and restarts the app. Cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handlePickRestore}
              disabled={isBackingUp || isRestoring}
              className="border border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] rounded-[7px] h-9"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isRestoring ? "Restoring…" : "Restore from Backup…"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRestorePath !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestorePath(null);
        }}
        title="Restore database?"
        description="Restore replaces ALL current data and restarts the app. Cannot be undone."
        confirmLabel="Restore & Restart"
        variant="danger"
        onConfirm={handleConfirmRestore}
      />
    </div>
  );
}