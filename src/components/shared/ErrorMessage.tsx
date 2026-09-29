// src/components/shared/ErrorMessage.tsx
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export function ErrorMessage({
  message,
  title = "Something went wrong",
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="bg-white border border-[#fecaca] rounded-lg p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2]">
        <AlertCircle className="h-5 w-5 text-[#dc2626]" />
      </div>
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      <p className="mt-1 wrap-break-word text-sm text-[#6b7280]">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="mt-4 h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}