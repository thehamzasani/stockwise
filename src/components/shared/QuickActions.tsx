// src/components/shared/QuickActions.tsx
import { useEffect, useRef, useState } from "react";
import { Plus, X, ShoppingCart, Truck, Package, UserPlus, Wallet } from "lucide-react";
import { useNavigate, type AppPage } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ACTIONS: { label: string; page: AppPage; icon: typeof Plus }[] = [
  { label: "New Sale",        page: "sales/new",     icon: ShoppingCart },
  { label: "New Purchase",    page: "purchases/new", icon: Truck },
  { label: "Record Payment",  page: "payments",      icon: Wallet },
  { label: "Add Customer",    page: "customers/add", icon: UserPlus },
  { label: "Add Product",     page: "inventory/add", icon: Package },
];

export default function QuickActions() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open &&
        ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={a.page}
              type="button"
              onClick={() => { setOpen(false); navigate(a.page); }}
              style={{ animationDelay: `${i * 30}ms` }}
              className="flex animate-in fade-in slide-in-from-bottom-2 items-center gap-2 rounded-full border border-[#e4e7ec] bg-white py-2 pl-3 pr-4 text-sm font-medium text-[#374151] shadow-md hover:bg-[#eff6ff] hover:text-[#2563eb]"
            >
              <Icon className="h-4 w-4" />
              {a.label}
            </button>
          );
        })}
      <button
        type="button"
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg transition-transform hover:bg-[#1d4ed8]",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>
    </div>
  );
}