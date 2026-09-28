// src/pages/purchases/NewPurchasePage.tsx
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@/lib/navigation";
// import { createPurchase } from "@/hooks/usePurchases";
import { PurchaseForm } from "@/components/purchases/PurchaseForm";
// import type { CreatePurchaseInput } from "@/hooks/usePurchases";
import { toast } from "sonner";

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() { //
    setIsSubmitting(true);
    try {
    //   const purchaseId = await createPurchase(input);
      toast.success("Purchase recorded successfully.");
      navigate("purchases");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save purchase.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("purchases")}
          className="p-1.5 rounded-[7px] border border-[#e4e7ec] text-[#6b7280]
                     hover:bg-[#f9fafb] hover:text-[#111827] transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">New Purchase</h1>
          <p className="text-sm text-[#6b7280]">Record stock received from a supplier</p>
        </div>
      </div>

      <PurchaseForm
        onSubmit={handleSubmit}
        onCancel={() => navigate("purchases")}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}