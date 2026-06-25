"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { calcInvoice } from "@/lib/calculations";
import {
  invoiceSchema,
  recordPaymentSchema,
  updateStatusSchema,
} from "@/lib/validations/invoice";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

type Tx = Prisma.TransactionClient;

/** Atomically increment the org counter and build the next invoice number. */
async function nextInvoiceNumber(tx: Tx, organizationId: string) {
  const org = await tx.organization.update({
    where: { id: organizationId },
    data: { invoiceCounter: { increment: 1 } },
    select: { invoiceCounter: true, invoicePrefix: true, currency: true },
  });
  const number = `${org.invoicePrefix}${String(org.invoiceCounter).padStart(4, "0")}`;
  return { number, currency: org.currency };
}

/** Deduct stock for each line tied to a product and log SALE adjustments. */
async function deductStock(
  tx: Tx,
  organizationId: string,
  userId: string,
  invoiceNumber: string,
  lines: { productId?: string | null; quantity: number }[],
) {
  for (const line of lines) {
    if (!line.productId) continue;
    const product = await tx.product.findFirst({
      where: { id: line.productId, organizationId },
      select: { id: true, quantityOnHand: true },
    });
    if (!product) continue;
    const newQuantity = product.quantityOnHand - line.quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand: newQuantity },
    });
    await tx.stockAdjustment.create({
      data: {
        organizationId,
        productId: product.id,
        type: "SALE",
        quantityChange: -line.quantity,
        previousQuantity: product.quantityOnHand,
        newQuantity,
        reason: `Invoice ${invoiceNumber}`,
        reference: invoiceNumber,
        createdById: userId,
      },
    });
  }
}

/** Restore stock previously deducted by a finalized invoice. */
async function restoreStock(
  tx: Tx,
  organizationId: string,
  userId: string,
  invoiceNumber: string,
  lines: { productId: string | null; quantity: number }[],
) {
  for (const line of lines) {
    if (!line.productId) continue;
    const product = await tx.product.findFirst({
      where: { id: line.productId, organizationId },
      select: { id: true, quantityOnHand: true },
    });
    if (!product) continue;
    const newQuantity = product.quantityOnHand + line.quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand: newQuantity },
    });
    await tx.stockAdjustment.create({
      data: {
        organizationId,
        productId: product.id,
        type: "RETURN",
        quantityChange: line.quantity,
        previousQuantity: product.quantityOnHand,
        newQuantity,
        reason: `Cancelled invoice ${invoiceNumber}`,
        reference: invoiceNumber,
        createdById: userId,
      },
    });
  }
}

export async function createInvoice(
  values: unknown,
  finalize = false,
): Promise<ActionResult<{ id: string }>> {
  const { organizationId, userId } = await requireOrg();
  const parsed = invoiceSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  // Verify the customer belongs to the org.
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, organizationId },
    select: { id: true },
  });
  if (!customer) {
    return { success: false, error: "Selected customer was not found." };
  }

  const totals = calcInvoice({
    lineItems: data.lineItems.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
    })),
    discountType: data.discountType,
    discountValue: data.discountValue,
  });

  const id = await prisma.$transaction(async (tx) => {
    const { number, currency } = await nextInvoiceNumber(tx, organizationId);

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        number,
        currency,
        customerId: data.customerId,
        status: finalize ? "SENT" : "DRAFT",
        finalizedAt: finalize ? new Date() : null,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
        terms: data.terms || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        lineItems: {
          create: data.lineItems.map((l, idx) => {
            const calc = totals.lines[idx];
            return {
              productId: l.productId || null,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              lineSubtotal: calc.lineSubtotal,
              lineTax: calc.lineTax,
              lineTotal: calc.lineTotal,
              sortOrder: idx,
            };
          }),
        },
      },
    });

    if (finalize) {
      await deductStock(tx, organizationId, userId, number, data.lineItems);
    }

    return invoice.id;
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  return {
    success: true,
    data: { id },
    message: finalize ? "Invoice created and finalized." : "Draft saved.",
  };
}

export async function updateInvoice(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = invoiceSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const existing = await prisma.invoice.findFirst({
    where: { id, organizationId },
    select: { status: true },
  });
  if (!existing) return { success: false, error: "Invoice not found." };
  if (existing.status !== "DRAFT") {
    return {
      success: false,
      error: "Only draft invoices can be edited. Cancel it first to change a finalized invoice.",
    };
  }

  const data = parsed.data;
  const totals = calcInvoice({
    lineItems: data.lineItems.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
    })),
    discountType: data.discountType,
    discountValue: data.discountValue,
  });

  await prisma.$transaction(async (tx) => {
    // Replace line items wholesale (simplest correct approach for drafts).
    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        customerId: data.customerId,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
        terms: data.terms || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        lineItems: {
          create: data.lineItems.map((l, idx) => {
            const calc = totals.lines[idx];
            return {
              productId: l.productId || null,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              lineSubtotal: calc.lineSubtotal,
              lineTax: calc.lineTax,
              lineTotal: calc.lineTotal,
              sortOrder: idx,
            };
          }),
        },
      },
    });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true, message: "Invoice updated." };
}

export async function finalizeInvoice(id: string): Promise<ActionResult> {
  const { organizationId, userId } = await requireOrg();

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, organizationId },
        include: { lineItems: true },
      });
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status !== "DRAFT") {
        throw new Error("Only draft invoices can be finalized.");
      }
      await tx.invoice.update({
        where: { id },
        data: { status: "SENT", finalizedAt: new Date() },
      });
      await deductStock(
        tx,
        organizationId,
        userId,
        invoice.number,
        invoice.lineItems,
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not finalize.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, message: "Invoice finalized and stock updated." };
}

export async function updateInvoiceStatus(
  values: unknown,
): Promise<ActionResult> {
  const { organizationId, userId } = await requireOrg();
  const parsed = updateStatusSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Invalid status." };
  }
  const { invoiceId, status } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { lineItems: true },
      });
      if (!invoice) throw new Error("Invoice not found");

      const wasActive = invoice.finalizedAt && invoice.status !== "CANCELLED";

      // Moving a finalized invoice into a stock-affecting state.
      if (
        status !== "DRAFT" &&
        status !== "CANCELLED" &&
        !invoice.finalizedAt
      ) {
        // First time leaving draft -> deduct stock.
        await deductStock(
          tx,
          organizationId,
          userId,
          invoice.number,
          invoice.lineItems,
        );
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status, finalizedAt: new Date() },
        });
        return;
      }

      // Cancelling an invoice that had deducted stock -> restore it.
      if (status === "CANCELLED" && wasActive) {
        await restoreStock(
          tx,
          organizationId,
          userId,
          invoice.number,
          invoice.lineItems,
        );
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status },
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update status.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, message: "Status updated." };
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const { organizationId, userId } = await requireOrg();

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, organizationId },
        include: { lineItems: true },
      });
      if (!invoice) throw new Error("Invoice not found");

      // Restore stock if it was deducted and not already restored by cancel.
      if (invoice.finalizedAt && invoice.status !== "CANCELLED") {
        await restoreStock(
          tx,
          organizationId,
          userId,
          invoice.number,
          invoice.lineItems,
        );
      }
      // Line items and payments cascade-delete via the schema.
      await tx.invoice.delete({ where: { id } });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not delete invoice.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, message: "Invoice deleted." };
}

export async function recordPayment(values: unknown): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = recordPaymentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  const { invoiceId, amount, method, reference, note, paidAt } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        select: { status: true, total: true, amountPaid: true },
      });
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === "DRAFT") {
        throw new Error("Finalize the invoice before recording a payment.");
      }
      if (invoice.status === "CANCELLED") {
        throw new Error("Cannot record a payment on a cancelled invoice.");
      }

      const newPaid = Number(invoice.amountPaid) + amount;
      const total = Number(invoice.total);
      const fullyPaid = newPaid >= total - 0.005;

      await tx.payment.create({
        data: {
          organizationId,
          invoiceId,
          amount,
          method,
          reference: reference || null,
          note: note || null,
          paidAt,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newPaid,
          status: fullyPaid ? "PAID" : invoice.status,
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not record payment.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
  return { success: true, message: "Payment recorded." };
}

export async function deletePayment(
  paymentId: string,
): Promise<ActionResult> {
  const { organizationId } = await requireOrg();

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: { invoice: { select: { id: true, total: true, status: true } } },
      });
      if (!payment) throw new Error("Payment not found");

      await tx.payment.delete({ where: { id: paymentId } });

      const agg = await tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId },
        _sum: { amount: true },
      });
      const newPaid = Number(agg._sum.amount ?? 0);
      const total = Number(payment.invoice.total);
      const stillPaid = newPaid >= total - 0.005;

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newPaid,
          // Drop back to SENT if it's no longer fully paid.
          status:
            payment.invoice.status === "PAID" && !stillPaid
              ? "SENT"
              : payment.invoice.status,
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not delete payment.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { success: true, message: "Payment removed." };
}
