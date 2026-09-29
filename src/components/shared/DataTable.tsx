// src/components/shared/DataTable.tsx

import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

export interface PaginationConfig {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  pagination?: PaginationConfig;
  onRowClick?: (row: T) => void;
  sortConfig?: SortConfig;
  onSort?: (key: string) => void;
  keyExtractor?: (row: T) => string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-[#e4e7ec]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-100 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  error,
  onRetry,
  emptyMessage = "No records found.",
  searchValue,
  onSearchChange,
  pagination,
  onRowClick,
  sortConfig,
  onSort,
  keyExtractor,
}: DataTableProps<T>) {
  const hasSearch = onSearchChange !== undefined;
  const hasPagination = pagination !== undefined;
  const isClickable = onRowClick !== undefined;

  function SortIcon({ colKey }: { colKey: string }) {
    if (!sortConfig || sortConfig.key !== colKey) {
      return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-[#9ca3af]" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3 text-[#2563eb]" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3 text-[#2563eb]" />
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Search bar */}
      {hasSearch && (
        <div className="mb-3">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="h-9 w-full max-w-xs rounded-[7px] border border-[#e4e7ec] bg-white px-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
          />
        </div>
      )}

      {/* Error state */}
      {error ? (
        <div className="rounded-lg border border-[#fecaca] bg-white p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-[#dc2626] mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Failed to load data</span>
          </div>
          <p className="text-xs text-[#6b7280] mb-3">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="h-8 rounded-[7px] border border-[#e4e7ec] bg-white px-4 text-xs font-medium text-[#374151] hover:bg-[#f9fafb]"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-[#e4e7ec] bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#e4e7ec] bg-[#f9fafb]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]",
                        col.sortable && onSort ? "cursor-pointer select-none hover:text-[#374151]" : ""
                      )}
                      onClick={() => {
                        if (col.sortable && onSort) onSort(col.key);
                      }}
                    >
                      {col.header}
                      {col.sortable && onSort && <SortIcon colKey={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} cols={columns.length} />
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center text-sm text-[#6b7280]"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  data.map((row, rowIdx) => {
                    const key = keyExtractor ? keyExtractor(row) : String(rowIdx);
                    return (
                      <tr
                        key={key}
                        onClick={() => onRowClick?.(row)}
                        className={cn(
                          "border-b border-[#e4e7ec] last:border-0",
                          isClickable ? "cursor-pointer hover:bg-[#f9fafb]" : "hover:bg-[#f9fafb]"
                        )}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className="px-4 py-3 text-[#374151]"
                            onClick={
                              col.key === "actions"
                                ? (e) => e.stopPropagation()
                                : undefined
                            }
                          >
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {hasPagination && pagination.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[#6b7280]">
                {pagination.totalCount} record{pagination.totalCount !== 1 ? "s" : ""} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-[#e4e7ec] bg-white text-[#374151] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-[#374151]">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-[#e4e7ec] bg-white text-[#374151] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Pagination (single page — just show count) */}
          {hasPagination && pagination.totalPages <= 1 && pagination.totalCount > 0 && (
            <div className="mt-3">
              <p className="text-xs text-[#6b7280]">
                {pagination.totalCount} record{pagination.totalCount !== 1 ? "s" : ""} total
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}