// src/components/shared/DataTable.tsx
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
// import { ITEMS_PER_PAGE } from "@/lib/constants";

export interface Column<T> {
  key: string;
  header: string;
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

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  pagination?: PaginationConfig;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  sortConfig?: SortConfig;
  onSort?: (key: string) => void;
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data found.",
  searchValue,
  onSearchChange,
  pagination,
  onRowClick,
  rowClassName,
  sortConfig,
  onSort,
}: DataTableProps<T>) {
  return (
    <div className="bg-white border border-[#e4e7ec] rounded-lg overflow-hidden">
      {/* Search bar */}
      {onSearchChange !== undefined && (
        <div className="px-4 py-3 border-b border-[#e4e7ec]">
          <div className="relative max-w-xs">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search…"
              className="w-full h-8 pl-8 pr-3 rounded-[7px] border border-[#e4e7ec] text-sm
                         text-[#374151] placeholder:text-[#9ca3af]
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide
                              text-[#6b7280] whitespace-nowrap
                              ${col.sortable && onSort ? "cursor-pointer select-none hover:text-[#374151]" : ""}`}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortConfig?.key === col.key && (
                      <span className="text-[#2563eb]">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#e4e7ec]">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-[#f3f4f6] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="text-sm text-[#6b7280]">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={(row as { id?: string }).id ?? idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    "border-b border-[#e4e7ec] last:border-0",
                    onRowClick ? "cursor-pointer" : "",
                    "hover:bg-[#f9fafb]",
                    rowClassName ? rowClassName(row) : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#e4e7ec]">
          <p className="text-xs text-[#6b7280]">
            {pagination.totalCount} result{pagination.totalCount !== 1 ? "s" : ""}
            {" · "}Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-[7px] border border-[#e4e7ec] text-[#374151]
                         hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => pagination.onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-[7px] text-xs font-medium transition-colors ${
                    pageNum === pagination.page
                      ? "bg-[#2563eb] text-white"
                      : "border border-[#e4e7ec] text-[#374151] hover:bg-[#f9fafb]"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-[7px] border border-[#e4e7ec] text-[#374151]
                         hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}