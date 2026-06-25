import type { InvoiceStatus } from "@prisma/client";

/**
 * Returns the status to display: a SENT invoice past its due date is shown as
 * OVERDUE without mutating the stored status.
 */
export function effectiveStatus(
  status: InvoiceStatus,
  dueDate: Date | string,
): InvoiceStatus {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (status === "SENT" && due.getTime() < Date.now()) {
    return "OVERDUE";
  }
  return status;
}

export function formatAddress(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}
