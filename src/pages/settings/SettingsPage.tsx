// src/pages/settings/SettingsPage.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, Database, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import  ConfirmDialog  from "@/components/shared/ConfirmDialog";
import { useSettings } from "@/hooks/useSettings";
import { calcInvoiceNo } from "@/lib/utils";
import { DataIntegritySection } from "@/components/settings/DataIntegritySection";
import { DataManagementSection } from "@/components/settings/DataManagementSection";
// ─── VALIDATION ──────────────────────────────────────────────────────────────
const settingsSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(100),
  businessPhone: z.string().trim().max(30),
  businessAddress: z.string().trim().max(200),
  businessCity: z.string().trim().max(60),
  currency: z.string().trim().min(1, "Currency symbol is required").max(8),
  invoicePrefix: z.string().trim().min(1, "Invoice prefix is required").max(10),
  taxEnabled: z.boolean(),
  taxRate: z
    .number({ invalid_type_error: "Enter a valid rate" })
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100%"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ─── SMALL LOCAL COMPONENTS ──────────────────────────────────────────────────
function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[#6b7280]">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-[#374151]">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-[#6b7280]">{hint}</p>}
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
    </div>
  );
}

function toFormValues(s: {
  businessName: string;
  businessPhone: string | null;
  businessAddress: string | null;
  businessCity: string | null;
  currency: string;
  invoicePrefix: string;
  taxEnabled: boolean;
  taxRate: number;
}): SettingsFormValues {
  return {
    businessName: s.businessName,
    businessPhone: s.businessPhone ?? "",
    businessAddress: s.businessAddress ?? "",
    businessCity: s.businessCity ?? "",
    currency: s.currency,
    invoicePrefix: s.invoicePrefix,
    taxEnabled: s.taxEnabled,
    taxRate: s.taxRate,
  };
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { data: settings, isLoading, error, refetch, saveSettings } = useSettings();

  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [isTogglingExpenses, setIsTogglingExpenses] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "",
      businessPhone: "",
      businessAddress: "",
      businessCity: "",
      currency: "Rs.",
      invoicePrefix: "INV-",
      taxEnabled: false,
      taxRate: 0,
    },
  });

  // Populate the form once when settings first load. We deliberately do NOT
  // reset on every settings change: toggling expenses updates `settings`,
  // and that must not wipe unsaved edits in the other fields.
  const initialised = useRef(false);
  useEffect(() => {
    if (settings && !initialised.current) {
      reset(toFormValues(settings));
      initialised.current = true;
    }
  }, [settings, reset]);

  const watchedPrefix = watch("invoicePrefix");
  const watchedTaxEnabled = watch("taxEnabled");

  async function onSubmit(values: SettingsFormValues) {
    try {
      const updated = await saveSettings({
        businessName: values.businessName.trim(),
        businessPhone: values.businessPhone.trim() || null,
        businessAddress: values.businessAddress.trim() || null,
        businessCity: values.businessCity.trim() || null,
        currency: values.currency.trim(),
        invoicePrefix: values.invoicePrefix.trim(),
        taxEnabled: values.taxEnabled,
        taxRate: values.taxRate,
      });
      reset(toFormValues(updated));
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function applyExpensesEnabled(enabled: boolean) {
    setIsTogglingExpenses(true);
    try {
      await saveSettings({ expensesEnabled: enabled });
      toast.success(
        enabled ? "Expense tracking enabled" : "Expense tracking disabled"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update expense tracking"
      );
    } finally {
      setIsTogglingExpenses(false);
    }
  }

  function handleExpenseToggle(checked: boolean) {
    if (!settings) return;
    // Turning OFF while currently ON requires confirmation
    if (!checked && settings.expensesEnabled) {
      setConfirmDisableOpen(true);
      return;
    }
    void applyExpensesEnabled(checked);
  }

  // ─── LOADING / ERROR ───────────────────────────────────────────────────────
  if (isLoading && !settings) {
    return (
      <div className="bg-[#f0f2f5] p-5 space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="bg-[#f0f2f5] p-5">
        <div className="flex items-center gap-3 rounded-lg border border-[#fecaca] bg-white p-4">
          <AlertCircle className="h-5 w-5 text-[#dc2626]" />
          <p className="flex-1 text-sm text-[#374151]">
            {error ?? "Settings could not be loaded."}
          </p>
          <Button
            onClick={refetch}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] h-9 px-4 text-sm font-medium"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f0f2f5] p-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Business Information */}
          <SectionCard
            title="Business Information"
            description="Shown on invoices and account statements."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  label="Business Name"
                  htmlFor="businessName"
                  error={errors.businessName?.message}
                >
                  <Input id="businessName" className="h-9" {...register("businessName")} />
                </Field>
              </div>
              <Field
                label="Phone"
                htmlFor="businessPhone"
                error={errors.businessPhone?.message}
              >
                <Input id="businessPhone" className="h-9" {...register("businessPhone")} />
              </Field>
              <Field
                label="City"
                htmlFor="businessCity"
                error={errors.businessCity?.message}
              >
                <Input id="businessCity" className="h-9" {...register("businessCity")} />
              </Field>
              <div className="md:col-span-2">
                <Field
                  label="Address"
                  htmlFor="businessAddress"
                  error={errors.businessAddress?.message}
                >
                  <Input id="businessAddress" className="h-9" {...register("businessAddress")} />
                </Field>
              </div>
              <Field
                label="Currency Symbol"
                htmlFor="currency"
                error={errors.currency?.message}
              >
                <Input id="currency" className="h-9" {...register("currency")} />
              </Field>
            </div>
          </SectionCard>

          {/* Invoice Settings */}
          <SectionCard
            title="Invoice Settings"
            description="Invoice numbers are sequential and never reused, even if an invoice is cancelled."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Invoice Prefix"
                htmlFor="invoicePrefix"
                error={errors.invoicePrefix?.message}
                hint="Applies to new invoices only. Existing invoices keep their numbers."
              >
                <Input id="invoicePrefix" className="h-9" {...register("invoicePrefix")} />
              </Field>
              <Field
                label="Next Invoice Number"
                htmlFor="nextInvoiceNo"
                hint="Assigned automatically when a sale is saved."
              >
                <Input
                  id="nextInvoiceNo"
                  className="h-9 bg-[#f9fafb]"
                  value={calcInvoiceNo(
                    (watchedPrefix ?? "").trim(),
                    settings.nextInvoiceNo
                  )}
                  readOnly
                  disabled
                />
              </Field>
            </div>
          </SectionCard>

          {/* Tax Settings */}
          <SectionCard
            title="Tax Settings"
            description="When enabled, tax can be applied to new sales and is shown on invoices."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111827]">Enable tax</p>
                  <p className="text-xs text-[#6b7280]">
                    Does not change previously created invoices.
                  </p>
                </div>
                <Switch
                  checked={watchedTaxEnabled}
                  onCheckedChange={(v) =>
                    setValue("taxEnabled", v, { shouldDirty: true })
                  }
                />
              </div>
              <div className="max-w-xs">
                <Field
                  label="Tax Rate (%)"
                  htmlFor="taxRate"
                  error={errors.taxRate?.message}
                >
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className="h-9"
                    disabled={!watchedTaxEnabled}
                    {...register("taxRate", { valueAsNumber: true })}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Save bar */}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || isSubmitting}
              onClick={() => reset(toFormValues(settings))}
              className="border border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] rounded-[7px] h-9"
            >
              Discard Changes
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] h-9 px-4 text-sm font-medium"
            >
              {isSubmitting ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>

        {/* Expense Tracking — saves immediately, independent of the form above */}
        <SectionCard
          title="Expense Tracking"
          description="Optional. Track rent, salaries, and other costs to see net profit in reports."
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">
                Enable expense tracking
              </p>
              <p className="text-xs text-[#6b7280]">
                {settings.expensesEnabled
                  ? "Expenses appear in the sidebar and net profit is shown in reports."
                  : "Expenses are hidden and reports show gross profit only."}
              </p>
            </div>
            <Switch
              checked={settings.expensesEnabled}
              disabled={isTogglingExpenses}
              onCheckedChange={handleExpenseToggle}
            />
          </div>
        </SectionCard>

        <DataIntegritySection />
        <SectionCard
          title="Data Integrity"
          description="Verify that cached balances and stock levels match transaction history."
        >
          <div className="flex items-center justify-between rounded-[7px] border border-dashed border-[#e4e7ec] bg-[#f9fafb] p-3">
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <ShieldCheck className="h-4 w-4" />
              Balance and stock checks will be available here.
            </div>
            <Button variant="outline" disabled className="rounded-[7px] h-9">
              Check Balances
            </Button>
          </div>
        </SectionCard>

        <DataManagementSection />
        <SectionCard
          title="Data Management"
          description="Back up and restore your database."
        >
          <div className="flex items-center justify-between rounded-[7px] border border-dashed border-[#e4e7ec] bg-[#f9fafb] p-3">
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <Database className="h-4 w-4" />
              Backup and restore will be available here.
            </div>
            <Button variant="outline" disabled className="rounded-[7px] h-9">
              Backup Database
            </Button>
          </div>
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmDisableOpen}
        onOpenChange={setConfirmDisableOpen}
        title="Disable expense tracking?"
        description="Disabling expense tracking will hide expense records from the sidebar and remove net profit from reports. Your data is NOT deleted. Continue?"
        confirmLabel="Disable"
        variant="danger"
        onConfirm={async () => {
          setConfirmDisableOpen(false);
          await applyExpensesEnabled(false);
        }}
      />
    </div>
  );
}

export default SettingsPage;