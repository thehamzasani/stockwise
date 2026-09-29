// src/pages/OpeningBalancesPage.tsx
import { useEffect, useState } from "react";
import { Lock, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOpeningEntities,
  setCustomerOpeningBalance,
  setSupplierOpeningBalance,
  setProductOpeningStock,
  type OpeningBalanceRow,
  type OpeningEntityType,
} from "@/hooks/useOpeningBalances";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { formatCurrency, todayDate } from "@/lib/utils";

// ─── LOCK / CORRECTION INDICATORS ────────────────────────────────────────────

function LockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6b7280]">
      <Lock className="h-3.5 w-3.5" />
      Locked — transactions exist
    </span>
  );
}

function CorrectableNote() {
  return (
    <span className="text-xs text-[#6b7280]">Correctable before transactions</span>
  );
}

// ─── BALANCE ROW (customer / supplier) ───────────────────────────────────────

function BalanceRow({
  row,
  entityType,
  onSaved,
}: {
  row: OpeningBalanceRow;
  entityType: "customer" | "supplier";
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(row.hasRecord ? String(row.amount) : "");
  const [asOfDate, setAsOfDate] = useState(row.asOfDate ?? todayDate());
  const [notes, setNotes] = useState(row.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount(row.hasRecord ? String(row.amount) : "");
    setAsOfDate(row.asOfDate ?? todayDate());
    setNotes(row.notes ?? "");
  }, [row]);

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed)) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      if (entityType === "customer") {
        await setCustomerOpeningBalance(row.id, parsed, asOfDate, notes);
      } else {
        await setSupplierOpeningBalance(row.id, parsed, asOfDate, notes);
      }
      toast.success(row.hasRecord ? "Opening balance corrected." : "Opening balance saved.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save opening balance.");
    } finally {
      setSaving(false);
    }
  }

  if (row.locked) {
    return (
      <TableRow>
        <TableCell className="font-medium text-[#111827]">{row.name}</TableCell>
        <TableCell className="text-sm text-[#374151]">
          {row.hasRecord ? formatCurrency(row.amount) : "—"}
        </TableCell>
        <TableCell className="text-sm text-[#6b7280]">{row.asOfDate ?? "—"}</TableCell>
        <TableCell className="text-sm text-[#6b7280]">{row.notes ?? "—"}</TableCell>
        <TableCell><LockedBadge /></TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-[#111827]">{row.name}</TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          className="h-9 w-36"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          className="h-9 w-40"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-9 w-48"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Button
            size="sm"
            disabled={saving}
            onClick={handleSave}
            className="h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : row.hasRecord ? "Save correction" : "Save"}
          </Button>
          {row.hasRecord && <CorrectableNote />}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── STOCK ROW (product) ─────────────────────────────────────────────────────

function StockRow({
  row,
  onSaved,
}: {
  row: OpeningBalanceRow;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState(row.quantity !== null ? String(row.quantity) : "");
  const [cost, setCost] = useState(row.costPrice !== null ? String(row.costPrice) : "");
  const [asOfDate, setAsOfDate] = useState(row.asOfDate ?? todayDate());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQty(row.quantity !== null ? String(row.quantity) : "");
    setCost(row.costPrice !== null ? String(row.costPrice) : "");
    setAsOfDate(row.asOfDate ?? todayDate());
  }, [row]);

  const qtyNum = parseInt(qty, 10);
  const costNum = parseFloat(cost);
  const previewValue =
    Number.isFinite(qtyNum) && Number.isFinite(costNum) ? qtyNum * costNum : null;

  async function handleSave() {
    if (!Number.isInteger(qtyNum) || qtyNum < 0) {
      toast.error("Quantity must be a whole number, 0 or more.");
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      toast.error("Enter a valid cost price.");
      return;
    }
    setSaving(true);
    try {
      await setProductOpeningStock(row.id, qtyNum, costNum, asOfDate);
      toast.success(row.hasRecord ? "Opening stock corrected." : "Opening stock saved.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save opening stock.");
    } finally {
      setSaving(false);
    }
  }

  if (row.locked) {
    return (
      <TableRow>
        <TableCell className="font-medium text-[#111827]">{row.name}</TableCell>
        <TableCell className="text-sm text-[#374151]">{row.quantity ?? "—"}</TableCell>
        <TableCell className="text-sm text-[#374151]">
          {row.costPrice !== null ? formatCurrency(row.costPrice) : "—"}
        </TableCell>
        <TableCell className="text-sm text-[#6b7280]">{row.asOfDate ?? "—"}</TableCell>
        <TableCell className="text-sm text-[#374151]">
          {row.hasRecord ? formatCurrency(row.amount) : "—"}
        </TableCell>
        <TableCell><LockedBadge /></TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-[#111827]">{row.name}</TableCell>
      <TableCell>
        <Input
          type="number"
          step="1"
          min="0"
          className="h-9 w-24"
          placeholder="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          className="h-9 w-28"
          placeholder="0.00"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          className="h-9 w-40"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
      </TableCell>
      <TableCell className="text-sm text-[#374151]">
        {previewValue !== null ? formatCurrency(previewValue) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Button
            size="sm"
            disabled={saving}
            onClick={handleSave}
            className="h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : row.hasRecord ? "Save correction" : "Save"}
          </Button>
          {row.hasRecord && <CorrectableNote />}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<OpeningEntityType, string> = {
  customer: "Customers",
  supplier: "Suppliers",
  product: "Products",
};

export default function OpeningBalancesPage() {
  const [tab, setTab] = useState<OpeningEntityType>("customer");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, totalCount, isLoading, error, refetch } = useOpeningEntities(
    tab,
    debouncedSearch,
    page
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  function changeTab(next: string) {
    setTab(next as OpeningEntityType);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  return (
    <div className="bg-[#f0f2f5] p-5">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111827]">
              Opening Balances
            </h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              Enter starting balances and stock. Values can be corrected until the first
              transaction exists for that entity, then they are locked.
            </p>
          </div>
          <Input
            className="h-9 w-64"
            placeholder={`Search ${TAB_LABELS[tab].toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={changeTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="customer">Customers</TabsTrigger>
            <TabsTrigger value="supplier">Suppliers</TabsTrigger>
            <TabsTrigger value="product">Products</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "customer" && (
          <p className="mb-3 text-xs text-[#6b7280]">
            Positive amount = the customer owes you. Walk-in Customer is excluded.
          </p>
        )}
        {tab === "supplier" && (
          <p className="mb-3 text-xs text-[#6b7280]">
            Positive amount = you owe the supplier.
          </p>
        )}
        {tab === "product" && (
          <p className="mb-3 text-xs text-[#6b7280]">
            Saving sets current stock and average cost directly to these values.
          </p>
        )}

        {error ? (
          <div className="flex items-center justify-between rounded-lg border border-[#fecaca] bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-[#dc2626]">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            <Button
              variant="outline"
              onClick={refetch}
              className="h-9 rounded-[7px] border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff]"
            >
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#6b7280]">
            No {TAB_LABELS[tab].toLowerCase()} found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  {tab === "product" ? (
                    <>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Product</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Opening Qty</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Cost / Unit</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">As of</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Value</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Action</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">
                        {tab === "customer" ? "Customer" : "Supplier"}
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Opening Balance (Rs.)</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">As of</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Notes</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-[#6b7280]">Action</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) =>
                  tab === "product" ? (
                    <StockRow key={row.id} row={row} onSaved={refetch} />
                  ) : (
                    <BalanceRow key={row.id} row={row} entityType={tab} onSaved={refetch} />
                  )
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!error && totalCount > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-[#6b7280]">
            <span>{totalCount} total</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-9 rounded-[7px]"
              >
                Prev
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 rounded-[7px]"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}