"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePayment } from "@/lib/actions/invoices";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export interface PaymentItem {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
}

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CHECK: "Check",
  OTHER: "Other",
};

export function PaymentsList({
  payments,
  currency,
  canEdit,
}: {
  payments: PaymentItem[];
  currency: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<PaymentItem | null>(null);
  const [pending, setPending] = useState(false);

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const result = await deletePayment(deleting.id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Removed.");
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-md border p-3 text-sm"
        >
          <div>
            <p className="font-medium">{formatCurrency(p.amount, currency)}</p>
            <p className="text-xs text-muted-foreground">
              {methodLabels[p.method] ?? p.method} · {formatDate(p.paidAt)}
              {p.reference ? ` · ${p.reference}` : ""}
            </p>
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => setDeleting(p)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove payment?"
        description="This deletes the payment and updates the invoice balance."
        confirmLabel="Remove"
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
