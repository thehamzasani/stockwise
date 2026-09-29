// src/pages/AuditLogPage.tsx
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AUDIT_EVENT_LABELS,
  getAuditDisplay,
  useAuditEntityTypes,
  useAuditLog,
} from "@/hooks/useAuditLog";
import { useNavigate, type AppPage } from "@/lib/navigation";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

const CARD = "bg-white border border-[#e4e7ec] rounded-lg p-4";
const INPUT =
  "h-9 rounded-[7px] border border-[#e4e7ec] bg-white px-3 text-sm text-[#111827] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]";
const TH = "px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280] bg-[#f9fafb]";
const TD = "px-3 py-2 text-sm text-[#374151] align-top";

// Entity type → detail/list page. Types with no page (settings, database) are not clickable.
function getEntityTarget(entityType: string): AppPage | null {
  switch (entityType) {
    case "sale":     return "sales";
    case "purchase": return "purchases";
    case "customer": return "customers/detail";
    case "supplier": return "suppliers";
    case "product":  return "inventory/edit";
    case "payment":  return "payments";
    default:         return null;
  }
}

function prettyJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function AuditLogPage() {
  const navigate = useNavigate();
  const entityTypes = useAuditEntityTypes();

  const [page, setPage]             = useState(1);
  const [eventType, setEventType]   = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  const { data, totalCount, isLoading, error, refetch } = useAuditLog({
    page,
    eventType: eventType || undefined,
    entityType: entityType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const hasFilters = Boolean(eventType || entityType || dateFrom || dateTo);

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setEventType("");
    setEntityType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="bg-[#f0f2f5] p-5">
      {/* Filters */}
      <div className={`${CARD} mb-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#6b7280]">Event</label>
            <select
              className={INPUT}
              value={eventType}
              onChange={(e) => updateFilter(setEventType, e.target.value)}
            >
              <option value="">All events</option>
              {Object.entries(AUDIT_EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#6b7280]">Entity</label>
            <select
              className={INPUT}
              value={entityType}
              onChange={(e) => updateFilter(setEntityType, e.target.value)}
            >
              <option value="">All entities</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#6b7280]">From</label>
            <input
              type="date"
              className={INPUT}
              value={dateFrom}
              onChange={(e) => updateFilter(setDateFrom, e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#6b7280]">To</label>
            <input
              type="date"
              className={INPUT}
              value={dateTo}
              onChange={(e) => updateFilter(setDateTo, e.target.value)}
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" className="h-9 text-sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={CARD}>
        {error ? (
          <div className="flex items-center justify-between rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3">
            <div className="flex items-center gap-2 text-sm text-[#dc2626]">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
            <Button
              size="sm"
              className="h-8 rounded-[7px] bg-[#2563eb] px-3 text-sm text-white hover:bg-[#1d4ed8]"
              onClick={refetch}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#e4e7ec]">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Description</th>
                  <th className={TH}>Entity</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-[#e4e7ec]">
                      <td colSpan={4} className="px-3 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-[#f3f4f6]" />
                      </td>
                    </tr>
                  ))}

                {!isLoading && (data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-[#6b7280]">
                      {hasFilters ? "No audit entries match these filters." : "No audit entries yet."}
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  (data ?? []).map((entry) => {
                    const d = getAuditDisplay(entry);
                    const target = getEntityTarget(entry.entityType);
                    const oldJson = prettyJson(entry.oldValues);
                    const newJson = prettyJson(entry.newValues);

                    return (
                      <tr key={entry.id} className="border-t border-[#e4e7ec] hover:bg-[#f9fafb]">
                        <td className={`${TD} whitespace-nowrap`}>
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className={TD}>
                          <span
                            className={
                              d.isRefund
                                ? "whitespace-nowrap rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#d97706]"
                                : "whitespace-nowrap rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1e40af]"
                            }
                          >
                            {d.label}
                          </span>
                        </td>
                        <td className={TD}>
                          <div>{d.description}</div>
                          {(oldJson || newJson) && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs font-medium text-[#2563eb]">
                                Details
                              </summary>
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                {oldJson && (
                                  <div>
                                    <div className="mb-1 text-xs font-semibold uppercase text-[#6b7280]">Before</div>
                                    <pre className="overflow-x-auto rounded bg-[#f9fafb] p-2 text-xs text-[#374151]">{oldJson}</pre>
                                  </div>
                                )}
                                {newJson && (
                                  <div>
                                    <div className="mb-1 text-xs font-semibold uppercase text-[#6b7280]">After</div>
                                    <pre className="overflow-x-auto rounded bg-[#f9fafb] p-2 text-xs text-[#374151]">{newJson}</pre>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          <div className="text-xs uppercase text-[#6b7280]">{entry.entityType}</div>
                          {entry.entityId &&
                            (target ? (
                              <button
                                type="button"
                                title={entry.entityId}
                                className="text-sm font-medium text-[#2563eb] hover:underline"
                                onClick={() => navigate(target, { id: entry.entityId ?? undefined })}
                              >
                                {entry.entityId.slice(0, 10)}
                              </button>
                            ) : (
                              <span title={entry.entityId} className="text-sm text-[#6b7280]">
                                {entry.entityId.slice(0, 10)}
                              </span>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#6b7280]">
            {totalCount} entr{totalCount === 1 ? "y" : "ies"}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-9 rounded-[7px] text-sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-sm text-[#374151]">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              className="h-9 rounded-[7px] text-sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditLogPage;