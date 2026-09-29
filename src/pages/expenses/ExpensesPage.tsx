// src/pages/expenses/ExpensesPage.tsx
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PlusCircle, Receipt, TrendingDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { useExpenses, deleteExpense, getExpenseSummary } from "@/hooks/useExpenses";
import { useAppStore } from "@/stores/appStore";
import { useNavigate } from "@/lib/navigation";
import { EXPENSE_CATEGORIES, ITEMS_PER_PAGE } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense } from "@/types";

export function ExpensesPage() {
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    if (settings && !settings.expensesEnabled) {
      navigate("settings");
    }
  }, [settings, navigate]);

  if (!settings?.expensesEnabled) return null;

  return <ExpensesPageInner />;
}

function ExpensesPageInner() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const [summary, setSummary] = useState<{ category: string; total: number }[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);

  const { data: expenses, totalCount, isLoading, error, refetch } = useExpenses({
    page,
    search,
    category,
    dateFrom,
    dateTo,
  });

  useEffect(() => {
    if (!dateFrom || !dateTo) {
      setSummary([]);
      setSummaryTotal(0);
      return;
    }
    let cancelled = false;
    getExpenseSummary(dateFrom, dateTo)
      .then((rows: { category: string; total: number }[]) => {
        if (cancelled) return;
        setSummary(rows);
        setSummaryTotal(rows.reduce((s: number, r: { category: string; total: number }) => s + r.total, 0));
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, expenses]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleCategoryChange = (v: string) => {
    setCategory(v === "all" ? "" : v);
    setPage(1);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingExpense(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!deletingExpense) return;
    try {
      await deleteExpense(deletingExpense.id);
      toast.success("Expense deleted");
      setDeletingExpense(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const columns = [
    {
      key: "expenseDate",
      header: "Date",
      render: (e: Expense) => (
        <span className="text-sm text-[#374151]">{formatDate(e.expenseDate)}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (e: Expense) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-xs font-medium text-[#1e40af]">
          {e.category}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (e: Expense) => (
        <div>
          <p className="text-sm text-[#111827]">{e.description}</p>
          {e.notes && <p className="text-xs text-[#6b7280] mt-0.5">{e.notes}</p>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (e: Expense) => (
        <span className="text-sm font-semibold text-[#dc2626]">
          {formatCurrency(e.amount)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (e: Expense) => (
        <div
          className="flex items-center gap-2 justify-end"
          onClick={(ev) => ev.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEdit(e)}
            className="h-7 px-2 text-xs border-[#e4e7ec] text-[#374151]"
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeletingExpense(e)}
            className="h-7 px-2 text-xs border-[#fecaca] text-[#dc2626] hover:bg-[#fee2e2]"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Expenses</h1>
          <p className="text-sm text-[#6b7280]">Track business operating costs</p>
        </div>
        <Button
          onClick={openAdd}
          className="h-9 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium gap-2"
        >
          <PlusCircle size={16} />
          Record Expense
        </Button>
      </div>

      {/* Summary cards (shown when date range is active) */}
      {dateFrom && dateTo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-[#e4e7ec] p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#fee2e2] flex items-center justify-center">
              <TrendingDown size={20} className="text-[#dc2626]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Total in Period</p>
              <p className="text-base font-semibold text-[#dc2626]">
                {formatCurrency(summaryTotal)}
              </p>
            </div>
          </div>

          {summary[0] && (
            <div className="bg-white rounded-lg border border-[#e4e7ec] p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#eff6ff] flex items-center justify-center">
                <Receipt size={20} className="text-[#2563eb]" />
              </div>
              <div>
                <p className="text-xs text-[#6b7280]">Top Category</p>
                <p className="text-sm font-semibold text-[#111827]">{summary[0].category}</p>
                <p className="text-xs text-[#6b7280]">{formatCurrency(summary[0].total)}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-[#e4e7ec] p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#f0fdf4] flex items-center justify-center">
              <Calendar size={20} className="text-[#16a34a]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Period</p>
              <p className="text-sm font-medium text-[#111827]">
                {formatDate(dateFrom)} — {formatDate(dateTo)}
              </p>
              <p className="text-xs text-[#6b7280]">{summary.length} categories</p>
            </div>
          </div>
        </div>
      )}

      {/* Category breakdown bar */}
      {dateFrom && dateTo && summary.length > 0 && (
        <div className="bg-white rounded-lg border border-[#e4e7ec] p-4">
          <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-3">
            Breakdown by Category
          </p>
          <div className="space-y-2">
            {summary.map((row) => {
              const pct = summaryTotal > 0 ? (row.total / summaryTotal) * 100 : 0;
              return (
                <div key={row.category}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-[#374151]">{row.category}</span>
                    <span className="text-xs font-medium text-[#374151]">
                      {formatCurrency(row.total)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#f3f4f6]">
                    <div
                      className="h-1.5 rounded-full bg-[#2563eb]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-50 max-w-xs">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search expenses…"
          />
        </div>

        <Select value={category || "all"} onValueChange={handleCategoryChange}>
          <SelectTrigger className="h-9 w-44 border-[#e4e7ec] text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Inline date range — DateRangeFilter component arrives in Task 18 */}
        <div className="flex items-center gap-2">
          <div className="space-y-0">
            <Label className="text-xs text-[#6b7280]">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9 w-36 border-[#e4e7ec] text-sm"
            />
          </div>
          <div className="space-y-0">
            <Label className="text-xs text-[#6b7280]">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9 w-36 border-[#e4e7ec] text-sm"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
              className="h-9 mt-4 text-xs border-[#e4e7ec] text-[#6b7280]"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#e4e7ec]">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#dc2626] mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="text-xs border-[#e4e7ec]"
            >
              Retry
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={expenses}
            isLoading={isLoading}
            emptyMessage={
              search || category || dateFrom
                ? "No expenses match your filters."
                : "No expenses recorded yet. Click 'Record Expense' to start."
            }
            pagination={{
              page,
              totalPages,
              totalCount,
              onPageChange: setPage,
            }}
          />
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingExpense(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#111827]">
              {editingExpense ? "Edit Expense" : "Record Expense"}
            </DialogTitle>
          </DialogHeader>
          <ExpenseForm
            expense={editingExpense ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingExpense(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
  open={!!deletingExpense}
  onOpenChange={(open) => { if (!open) setDeletingExpense(null); }}
  title="Delete Expense"
  description={
    deletingExpense
      ? `Delete "${deletingExpense.description}" (${formatCurrency(deletingExpense.amount)})? This cannot be undone.`
      : ""
  }
  confirmLabel="Delete"
  variant="danger"
  onConfirm={handleDelete}
/>
    </div>
  );
}