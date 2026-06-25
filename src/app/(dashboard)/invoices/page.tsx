import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  InvoicesClient,
  type InvoiceRow,
} from "@/components/invoices/invoices-client";

export const metadata: Metadata = { title: "Invoices — InvoFlow" };

export default async function InvoicesPage() {
  const { organizationId } = await requireOrg();

  const invoices = await prisma.invoice.findMany({
    where: { organizationId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    customerName: inv.customer.name,
    status: inv.status,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    total: toNumber(inv.total),
    amountPaid: toNumber(inv.amountPaid),
    currency: inv.currency,
  }));

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Create, track, and get paid on your invoices."
      />
      <InvoicesClient invoices={rows} />
    </>
  );
}
