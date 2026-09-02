// src/components/products/StockAdjustmentDialog.tsx
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adjustStock, type AdjustStockType } from "@/hooks/useProducts";
import type { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface StockAdjustmentDialogProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  product,
  open,
  onClose,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const [type, setType]         = useState<AdjustStockType>("adjustment_add");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState(String(product.avgCost));
  const [notes, setNotes]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setType("adjustment_add");
    setQuantity("");
    setCostPrice(String(product.avgCost));
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    if (type === "correction" && qty < 0) {
      toast.error("Correction quantity must be 0 or more.");
      return;
    }
    if (type !== "correction" && qty === 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await adjustStock({
        productId: product.id,
        type,
        quantity: qty,
        costPrice: type === "adjustment_add" ? parseFloat(costPrice) || product.avgCost : undefined,
        notes: notes || undefined,
      });
      toast.success(
        type === "adjustment_add"
          ? `Added ${qty} units to stock.`
          : type === "adjustment_remove"
          ? `Removed ${qty} units from stock.`
          : `Stock corrected to ${qty} units.`
      );
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust stock.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const typeLabel =
    type === "adjustment_add"
      ? "Add Stock"
      : type === "adjustment_remove"
      ? "Remove Stock"
      : "Set Exact Count";

  const qtyLabel =
    type === "adjustment_add"
      ? "Quantity to Add"
      : type === "adjustment_remove"
      ? "Quantity to Remove"
      : "New Exact Stock Count";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-[#111827]">
            Adjust Stock — {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current stock info */}
          <div className="rounded-lg bg-[#f0f2f5] px-4 py-3 flex gap-6 text-sm">
            <div>
              <span className="text-[#6b7280]">Current Stock:</span>{" "}
              <span className="font-semibold text-[#111827]">{product.stock}</span>
            </div>
            <div>
              <span className="text-[#6b7280]">Avg Cost:</span>{" "}
              <span className="font-semibold text-[#111827]">
                {formatCurrency(product.avgCost)}
              </span>
            </div>
          </div>

          {/* Adjustment type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#111827]">Adjustment Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AdjustStockType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjustment_add">Add Stock (e.g. found extra units)</SelectItem>
                <SelectItem value="adjustment_remove">Remove Stock (e.g. damaged / missing)</SelectItem>
                <SelectItem value="correction">Set Exact Count (stock-take correction)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-qty" className="text-sm font-medium text-[#111827]">
              {qtyLabel}
            </Label>
            <Input
              id="adj-qty"
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="h-9"
              autoFocus
            />
          </div>

          {/* Cost price — only for adjustment_add */}
          {type === "adjustment_add" && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-cost" className="text-sm font-medium text-[#111827]">
                Cost Price per Unit (Rs.)
              </Label>
              <Input
                id="adj-cost"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-[#6b7280]">
                Used to recalculate Weighted Average Cost
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-notes" className="text-sm font-medium text-[#111827]">
              Notes (optional)
            </Label>
            <Textarea
              id="adj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment…"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Preview */}
          {quantity && !isNaN(parseInt(quantity, 10)) && (
            <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm">
              <span className="text-[#1e40af]">
                {type === "adjustment_add" && (
                  <>Stock will change: <strong>{product.stock}</strong> → <strong>{product.stock + parseInt(quantity, 10)}</strong></>
                )}
                {type === "adjustment_remove" && (
                  <>Stock will change: <strong>{product.stock}</strong> → <strong>{Math.max(0, product.stock - parseInt(quantity, 10))}</strong></>
                )}
                {type === "correction" && (
                  <>Stock will be set to: <strong>{parseInt(quantity, 10)}</strong> (was {product.stock})</>
                )}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="h-9 rounded-[7px] border-[#e4e7ec] text-[#374151]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity}
            className="h-9 px-5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] text-sm font-medium"
          >
            {isSubmitting ? "Saving…" : typeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}