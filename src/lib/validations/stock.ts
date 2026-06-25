import { z } from "zod";

export const stockChangeTypes = [
  "PURCHASE",
  "RETURN",
  "ADJUSTMENT",
  "DAMAGE",
  "INITIAL",
] as const;

// Manual stock adjustment. `quantityChange` is signed: positive adds stock,
// negative removes it. SALE adjustments are created automatically by invoicing.
export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  type: z.enum(stockChangeTypes),
  quantityChange: z.coerce
    .number()
    .int("Must be a whole number")
    .refine((n) => n !== 0, "Quantity change cannot be zero"),
  reason: z.string().max(300).optional().or(z.literal("")),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
