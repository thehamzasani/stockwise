// src/components/shared/GlobalSearch.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Package, Users, FileText, Loader2 } from "lucide-react";
import { getSqlite } from "@/db";
import { useNavigate } from "@/lib/navigation";
import { WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export const FOCUS_SEARCH_EVENT = "stockwise:focus-search";

type ResultKind = "product" | "customer" | "invoice";

interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
}

const KIND_META: Record<ResultKind, { label: string; icon: typeof Package }> = {
  product:  { label: "Products",  icon: Package },
  customer: { label: "Customers", icon: Users },
  invoice:  { label: "Invoices",  icon: FileText },
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setActive(0);
  }, []);

  // Ctrl+K (dispatched by useKeyboardShortcuts) focuses the input
  useEffect(() => {
    const onFocusRequest = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusRequest);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusRequest);
  }, []);

  // Click outside closes
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [close]);

  // Debounced search (300ms) with stale-response protection
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myId = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const sqlite = getSqlite();
        const like = `%${q}%`;

        const products = await sqlite.select<{
          id: string; name: string; category: string; stock: number; unit: string; sale_price: number;
        }[]>(
          `SELECT id, name, category, stock, unit, sale_price FROM products
            WHERE is_active = 1 AND (name LIKE ? OR barcode LIKE ? OR brand LIKE ?)
            ORDER BY name ASC LIMIT 5`,
          [like, like, like]
        );

        // WALKIN excluded from customer results
        const customers = await sqlite.select<{
          id: string; shop_name: string; owner_name: string | null;
          city: string | null; outstanding_balance: number;
        }[]>(
          `SELECT id, shop_name, owner_name, city, outstanding_balance FROM customers
            WHERE id != ? AND is_active = 1
              AND (shop_name LIKE ? OR owner_name LIKE ? OR phone LIKE ?)
            ORDER BY shop_name ASC LIMIT 5`,
          [WALKIN_CUSTOMER_ID, like, like, like]
        );

        const invoices = await sqlite.select<{
          id: string; invoice_no: string; total_amount: number; sale_date: string; shop_name: string;
        }[]>(
          `SELECT s.id, s.invoice_no, s.total_amount, s.sale_date, c.shop_name
             FROM sales s JOIN customers c ON c.id = s.customer_id
            WHERE s.is_cancelled = 0 AND s.invoice_no LIKE ?
            ORDER BY s.sale_date DESC LIMIT 5`,
          [like]
        );

        if (myId !== requestId.current) return; // a newer query superseded this one

        const merged: SearchResult[] = [
          ...products.map((p): SearchResult => ({
            kind: "product",
            id: p.id,
            title: p.name,
            subtitle: `${p.category} · ${p.stock} ${p.unit} in stock · ${formatCurrency(p.sale_price)}`,
          })),
          ...customers.map((c): SearchResult => ({
            kind: "customer",
            id: c.id,
            title: c.shop_name,
            subtitle: [c.owner_name, c.city].filter(Boolean).join(" · ") +
              (c.outstanding_balance > 0 ? ` · Owes ${formatCurrency(c.outstanding_balance)}` : ""),
          })),
          ...invoices.map((i): SearchResult => ({
            kind: "invoice",
            id: i.id,
            title: i.invoice_no,
            subtitle: `${i.shop_name} · ${formatDate(i.sale_date)} · ${formatCurrency(i.total_amount)}`,
          })),
        ];
        setResults(merged);
        setActive(0);
        setLoading(false);
      } catch (err) {
        console.error("[GlobalSearch]", err);
        if (myId === requestId.current) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const select = useCallback(
    (r: SearchResult) => {
      close();
      setQuery("");
      setResults([]);
      inputRef.current?.blur();
      if (r.kind === "product") navigate("inventory/edit", { id: r.id });
      else if (r.kind === "customer") navigate("customers/detail", { id: r.id });
      else navigate("sales", { id: r.id });
    },
    [close, navigate]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(results[active]);
    }
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative w-72">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products, customers, invoices…"
          className="h-9 w-full rounded-[7px] border border-[#e4e7ec] bg-white pl-8 pr-14 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#6b7280]" />
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#e4e7ec] bg-[#f9fafb] px-1.5 py-0.5 text-[10px] font-medium text-[#6b7280]">
            Ctrl K
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-[#e4e7ec] bg-white shadow-lg">
          {!loading && results.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-[#6b7280]">No results for “{query.trim()}”</p>
          )}
          {(["product", "customer", "invoice"] as ResultKind[]).map((kind) => {
            const group = results.filter((r) => r.kind === kind);
            if (group.length === 0) return null;
            const { label, icon: Icon } = KIND_META[kind];
            return (
              <div key={kind}>
                <div className="bg-[#f9fafb] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  {label}
                </div>
                {group.map((r) => {
                  const idx = results.indexOf(r);
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => select(r)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left",
                        idx === active ? "bg-[#eff6ff]" : "hover:bg-[#f9fafb]"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#2563eb]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#111827]">{r.title}</span>
                        <span className="block truncate text-xs text-[#6b7280]">{r.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}