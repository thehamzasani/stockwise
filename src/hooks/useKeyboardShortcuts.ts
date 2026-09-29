// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";
import { useNavigate } from "@/lib/navigation";
import { FOCUS_SEARCH_EVENT } from "@/components/shared/GlobalSearch";

// MUST be called from a component rendered INSIDE <NavigationContext.Provider>.
export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          navigate("sales/new");
          break;
        case "p":
          e.preventDefault(); // also blocks the browser print dialog
          navigate("purchases/new");
          break;
        case "k":
          e.preventDefault();
          window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}