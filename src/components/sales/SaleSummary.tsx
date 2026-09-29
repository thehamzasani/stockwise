// src/components/sales/SaleSummary.tsx
import { WALKIN_CUSTOMER_ID, PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

interface SaleSummaryProps {
  customerId: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  paymentMethod: PaymentMethod | null;
  taxEnabled: boolean;
  currency: string;
  onDiscountChange: (v: number) => void;
  onPaidChange: (v: number) => void;
  onPaymentMethodChange: (v: PaymentMethod | null) => void;
}

export function SaleSummary({
  customerId,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paidAmount,
  balanceDue,
  paymentMethod,
  taxEnabled,
  currency,
  onDiscountChange,
  onPaidChange,
  onPaymentMethodChange,
}: SaleSummaryProps) {
  const isWalkin = customerId === WALKIN_CUSTOMER_ID;

  // Walk-in: paidAmount is always forced = total, cannot be changed
  const effectivePaid = isWalkin ? total : paidAmount;
  const effectiveBalance = isWalkin ? 0 : balanceDue;

  return (
    <div className="bg-white border border-[#e4e7ec] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[#111827] uppercase tracking-wide">
        Order Summary
      </h3>

      {/* Subtotal */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6b7280]">Subtotal</span>
        <span className="font-medium text-[#111827]">{formatCurrency(subtotal, currency)}</span>
      </div>

      {/* Discount */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6b7280]">Discount (Rs.)</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={discountAmount}
          onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
          className="w-28 h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm text-right
                     focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
        />
      </div>

      {/* Tax — only shown when taxEnabled */}
      {taxEnabled && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6b7280]">Tax</span>
          <span className="font-medium text-[#111827]">{formatCurrency(taxAmount, currency)}</span>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-[#e4e7ec]" />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#111827]">Total</span>
        <span className="text-base font-bold text-[#2563eb]">{formatCurrency(total, currency)}</span>
      </div>

      {/* Walk-in badge */}
      {isWalkin && (
        <div className="rounded-[7px] bg-[#eff6ff] border border-[#bfdbfe] px-3 py-2">
          <p className="text-xs text-[#1e40af] font-medium">
            Walk-in / Cash Sale — full payment required
          </p>
        </div>
      )}

      {/* Amount Paid */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6b7280]">Amount Paid</span>
        {isWalkin ? (
          <span className="font-semibold text-[#16a34a]">{formatCurrency(total, currency)}</span>
        ) : (
          <input
            type="number"
            min={0}
            max={total}
            step={0.01}
            value={paidAmount}
            onChange={(e) => onPaidChange(parseFloat(e.target.value) || 0)}
            className="w-28 h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm text-right
                       focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
        )}
      </div>

      {/* Balance Due */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6b7280]">Balance Due</span>
        <span
          className={`font-semibold ${
            effectiveBalance > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
          }`}
        >
          {formatCurrency(effectiveBalance, currency)}
        </span>
      </div>

      {/* Payment Method */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#374151]">
          Payment Method{(effectivePaid > 0 || isWalkin) ? " *" : ""}
        </label>
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() =>
                onPaymentMethodChange(
                  paymentMethod === m.value ? null : (m.value as PaymentMethod)
                )
              }
              className={`px-3 py-1.5 rounded-[7px] text-xs font-medium border transition-colors ${
                paymentMethod === m.value
                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : "bg-white text-[#374151] border-[#e4e7ec] hover:border-[#2563eb] hover:text-[#2563eb]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {(effectivePaid > 0 || isWalkin) && !paymentMethod && (
          <p className="text-xs text-[#dc2626]">Payment method is required.</p>
        )}
      </div>

      {/* Credit extended note */}
      {!isWalkin && effectiveBalance > 0 && (
        <div className="rounded-[7px] bg-[#fef3c7] border border-[#fde68a] px-3 py-2">
          <p className="text-xs text-[#d97706]">
            {formatCurrency(effectiveBalance, currency)} will be recorded as credit.
          </p>
        </div>
      )}
    </div>
  );
}