import { z } from "zod";

export const invoiceStatuses = [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export const discountTypes = ["NONE", "PERCENTAGE", "FIXED"] as const;

export const lineItemSchema = z.object({
  productId: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "Description is required").max(300),
  quantity: z.coerce.number().int().min(1, "Qty must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or more"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  paymentTerms: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  terms: z.string().max(1000).optional().or(z.literal("")),
  discountType: z.enum(discountTypes).default("NONE"),
  discountValue: z.coerce.number().min(0).default(0),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().max(100).optional().or(z.literal("")),
  note: z.string().max(300).optional().or(z.literal("")),
  paidAt: z.coerce.date().default(() => new Date()),
});

export const updateStatusSchema = z.object({
  invoiceId: z.string().min(1),
  status: z.enum(invoiceStatuses),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
