// src/stores/appStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings } from "@/types";

interface AppState {
  settings: AppSettings | null;
  sidebarCollapsed: boolean;
  setSettings: (s: AppSettings) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: null,
      sidebarCollapsed: false,
      setSettings: (settings) => set({ settings }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    { name: "stockwise-app" }
  )
);