// src/pages/sales/NewSalePage.tsx
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { SaleForm } from "@/components/sales/SaleForm";
import { useSaleStore } from "@/stores/saleStore";
import { useNavigate, useCurrentPage } from "@/lib/navigation";
import { printInvoiceById } from "@/hooks/usePDF";
export function NewSalePage() {
  const navigate = useNavigate();
  const { params } = useCurrentPage();
  const resetSale = useSaleStore((s) => s.resetSale);

  useEffect(() => {
    resetSale();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSuccess(_saleId: string) {
    navigate("sales");
  }

  function handlePrintReady(saleId: string) {
  void printInvoiceById(saleId);
}

  return (
    <div className="p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("sales")}
          className="p-1.5 rounded-[7px] text-[#6b7280] hover:text-[#111827] hover:bg-[#f9fafb]
                     transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-[#111827]">New Sale</h1>
          <p className="text-sm text-[#6b7280]">Create a new sales invoice</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <SaleForm
          initialCustomerId={params.customerId ?? null}
          onSuccess={handleSuccess}
          onPrintReady={handlePrintReady}
          onCancel={() => navigate("sales")}
        />
      </div>
    </div>
  );
}