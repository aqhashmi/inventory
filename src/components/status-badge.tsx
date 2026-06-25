import type { InvoiceStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

const statusVariant: Record<
  InvoiceStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "info"
> = {
  DRAFT: "secondary",
  SENT: "info",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "warning",
};

const statusLabel: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}
