// src/components/expenses/ExpenseForm.tsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { todayDate } from "@/lib/utils";
import { createExpense, updateExpense, type CreateExpenseInput } from "@/hooks/useExpenses";
import type { Expense } from "@/types";

const schema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required").max(200),
  amount: z
    .number({ invalid_type_error: "Enter a valid amount" })
    .positive("Amount must be greater than zero"),
  expenseDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const isEditing = !!expense;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: expense?.category ?? "",
      description: expense?.description ?? "",
      amount: expense?.amount ?? undefined,
      expenseDate: expense?.expenseDate ?? todayDate(),
      notes: expense?.notes ?? "",
    },
  });

  const selectedCategory = watch("category");

  useEffect(() => {
    if (expense) {
      reset({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        notes: expense.notes ?? "",
      });
    }
  }, [expense, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const input: CreateExpenseInput = {
        category: values.category,
        description: values.description,
        amount: values.amount,
        expenseDate: values.expenseDate,
        notes: values.notes || undefined,
      };

      if (isEditing && expense) {
        await updateExpense({ ...input, id: expense.id });
        toast.success("Expense updated");
      } else {
        await createExpense(input);
        toast.success("Expense recorded");
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save expense");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Category */}
      <div className="space-y-1">
        <Label className="text-sm font-medium text-[#374151]">
          Category <span className="text-[#dc2626]">*</span>
        </Label>
        <Select
          value={selectedCategory}
          onValueChange={(v) => setValue("category", v, { shouldValidate: true })}
        >
          <SelectTrigger className="h-9 border-[#e4e7ec]">
            <SelectValue placeholder="Select category…" />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-xs text-[#dc2626]">{errors.category.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="text-sm font-medium text-[#374151]">
          Description <span className="text-[#dc2626]">*</span>
        </Label>
        <Input
          {...register("description")}
          placeholder="e.g. Monthly office rent"
          className="h-9 border-[#e4e7ec]"
        />
        {errors.description && (
          <p className="text-xs text-[#dc2626]">{errors.description.message}</p>
        )}
      </div>

      {/* Amount + Date row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-[#374151]">
            Amount (Rs.) <span className="text-[#dc2626]">*</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            {...register("amount", { valueAsNumber: true })}
            placeholder="0.00"
            className="h-9 border-[#e4e7ec]"
          />
          {errors.amount && (
            <p className="text-xs text-[#dc2626]">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium text-[#374151]">
            Date <span className="text-[#dc2626]">*</span>
          </Label>
          <Input
            type="date"
            {...register("expenseDate")}
            className="h-9 border-[#e4e7ec]"
          />
          {errors.expenseDate && (
            <p className="text-xs text-[#dc2626]">{errors.expenseDate.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-sm font-medium text-[#374151]">Notes</Label>
        <Textarea
          {...register("notes")}
          placeholder="Optional notes…"
          rows={2}
          className="border-[#e4e7ec] resize-none text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-9 rounded-[7px] border-[#e4e7ec] text-[#374151]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-9 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
        >
          {isSubmitting ? "Saving…" : isEditing ? "Update Expense" : "Record Expense"}
        </Button>
      </div>
    </form>
  );
}