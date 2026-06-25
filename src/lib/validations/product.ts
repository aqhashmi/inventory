import { z } from "zod";

// Coerce so the schema works directly with HTML form string inputs.
const money = z.coerce.number().min(0, "Must be 0 or more");
const intQty = z.coerce.number().int("Must be a whole number");

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(64),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  unitPrice: money,
  costPrice: money,
  quantityOnHand: intQty.min(0, "Cannot be negative"),
  reorderLevel: intQty.min(0, "Cannot be negative"),
  unitOfMeasure: z.string().min(1).max(32).default("unit"),
  taxRate: z.coerce.number().min(0).max(100),
  isActive: z.coerce.boolean().default(true),
});

// On update we don't reset stock through the product form — stock changes go
// through the dedicated stock-adjustment flow.
export const productUpdateSchema = productSchema.omit({ quantityOnHand: true });

export const csvProductRowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  unitPrice: money.default(0),
  costPrice: money.default(0),
  quantityOnHand: intQty.min(0).default(0),
  reorderLevel: intQty.min(0).default(0),
  unitOfMeasure: z.string().optional().default("unit"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CsvProductRow = z.infer<typeof csvProductRowSchema>;
