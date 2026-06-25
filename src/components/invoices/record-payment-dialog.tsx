"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { recordPayment } from "@/lib/actions/invoices";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Method = "CASH" | "CARD" | "BANK_TRANSFER" | "CHECK" | "OTHER";

const methodLabels: Record<Method, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CHECK: "Check",
  OTHER: "Other",
};

interface PaymentFormValues {
  amount: number;
  method: Method;
  reference: string;
  note: string;
  paidAt: string;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  balance: number;
  currency: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  balance,
  currency,
}: RecordPaymentDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<PaymentFormValues>({
    defaultValues: {
      amount: balance,
      method: "BANK_TRANSFER",
      reference: "",
      note: "",
      paidAt: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({
        amount: balance,
        method: "BANK_TRANSFER",
        reference: "",
        note: "",
        paidAt: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, balance, reset]);

  const method = watch("method");

  async function onSubmit(values: PaymentFormValues) {
    setServerError(null);
    const result = await recordPayment({ ...values, invoiceId });
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    toast.success(result.message ?? "Payment recorded.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Outstanding balance: {formatCurrency(balance, currency)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...register("paidAt")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={method}
              onValueChange={(v) => setValue("method", v as Method)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(methodLabels) as Method[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {methodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference (optional)</Label>
            <Input {...register("reference")} placeholder="Transaction ID, cheque #" />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input {...register("note")} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
