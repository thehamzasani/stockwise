// src/components/shared/ConfirmDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  variant      = "danger",
  onConfirm,
  isLoading    = false,
}: ConfirmDialogProps) {
  const confirmStyle =
    variant === "danger"
      ? "bg-[#dc2626] hover:bg-[#b91c1c] text-white"
      : variant === "warning"
      ? "bg-[#d97706] hover:bg-[#b45309] text-white"
      : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            {variant !== "default" && (
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  variant === "danger" ? "bg-[#fee2e2]" : "bg-[#fef3c7]"
                }`}
              >
                <AlertTriangle
                  size={16}
                  className={variant === "danger" ? "text-[#dc2626]" : "text-[#d97706]"}
                />
              </div>
            )}
            <DialogTitle className="text-[15px]">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-[#374151]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2">
          <Button
            variant="outline"
            className="rounded-[7px] h-9 border-[#e4e7ec] text-[#374151]"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            className={`rounded-[7px] h-9 px-4 text-sm font-medium ${confirmStyle}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Processing…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}