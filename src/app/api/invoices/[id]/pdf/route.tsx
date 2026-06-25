import { renderToBuffer } from "@react-pdf/renderer";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { effectiveStatus, formatAddress } from "@/lib/invoice-utils";
import { InvoicePdf, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { organizationId } = await requireOrg();

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      organization: true,
    },
  });

  if (!invoice) {
    return new Response("Not found", { status: 404 });
  }

  const total = toNumber(invoice.total);
  const amountPaid = toNumber(invoice.amountPaid);
  const org = invoice.organization;
  const c = invoice.customer;

  const data: InvoicePdfData = {
    number: invoice.number,
    status: effectiveStatus(invoice.status, invoice.dueDate),
    issueDate: fmtDate(invoice.issueDate),
    dueDate: fmtDate(invoice.dueDate),
    currency: invoice.currency,
    paymentTerms: invoice.paymentTerms,
    notes: invoice.notes,
    terms: invoice.terms,
    org: {
      name: org.name,
      email: org.email,
      phone: org.phone,
      taxId: org.taxId,
      address: formatAddress([
        org.addressLine1,
        org.addressLine2,
        org.city,
        org.state,
        org.postalCode,
        org.country,
      ]),
    },
    customer: {
      name: c.name,
      email: c.email,
      address: formatAddress([
        c.billingAddressLine1,
        c.billingAddressLine2,
        c.billingCity,
        c.billingState,
        c.billingPostalCode,
        c.billingCountry,
      ]),
    },
    lineItems: invoice.lineItems.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: toNumber(l.unitPrice),
      taxRate: toNumber(l.taxRate),
      lineTotal: toNumber(l.lineTotal),
    })),
    subtotal: toNumber(invoice.subtotal),
    discountTotal: toNumber(invoice.discountTotal),
    taxTotal: toNumber(invoice.taxTotal),
    total,
    amountPaid,
    balance: total - amountPaid,
  };

  const buffer = await renderToBuffer(<InvoicePdf data={data} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
