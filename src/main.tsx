// src/main.tsx
// Startup sequence (MUST NOT be reordered):
//   1. Database.load()        — open/create the SQLite file
//   2. runMigrations(sqlite)  — create tables if needed
//   3. seedInitialData(sqlite)— insert Walk-in Customer + default settings if missing
//   4. initDb(sqlite)         — sets PRAGMA foreign_keys=ON, runs integrity_check,
//                               wires Drizzle proxy. getDb()/getSqlite() work after this.
//   5. render <App />

import { StrictMode, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import Database from "@tauri-apps/plugin-sql";
import { runMigrations } from "./db/migrations";
import { seedInitialData } from "./db/seed";
import { initDb } from "./db/index";
import App from "./App";
import "./index.css";

function Bootstrap() {
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [status, setStatus] = useState("Starting…");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatus("Opening database…");
        const sqlite = await Database.load("sqlite:stockwise.db");

        setStatus("Running migrations…");
        await runMigrations(sqlite);

        setStatus("Seeding initial data…");
        await seedInitialData(sqlite);

        setStatus("Initializing…");
        await initDb(sqlite); // sets PRAGMA foreign_keys=ON + integrity_check inside

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("[StockWise] Startup failed:", err);
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready) return <App />;

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f0f2f5]">
        <div className="max-w-md rounded-lg border border-[#fecaca] bg-white p-6 text-center shadow-sm">
          <div className="mb-3 text-3xl">⚠️</div>
          <h2 className="mb-2 text-base font-semibold text-[#111827]">
            Failed to Start StockWise
          </h2>
          <p className="mb-4 text-sm text-[#6b7280]">
            The database could not be initialized. If the problem persists,
            restore from a backup.
          </p>
          <code className="block rounded bg-[#f9fafb] p-3 text-left text-xs text-[#dc2626] break-all">
            {error}
          </code>
          <button
            className="mt-4 rounded-[7px] bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
            onClick={() => window.location.reload()}
          >
            Restart App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#f0f2f5]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
        <p className="text-sm font-medium text-[#374151]">
          Starting StockWise…
        </p>
        <p className="mt-1 text-xs text-[#6b7280]">{status}</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);