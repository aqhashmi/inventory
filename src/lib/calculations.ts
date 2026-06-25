import { round2 } from "@/lib/utils";

export interface CalcLineInput {
  quantity: number;
  unitPrice: number;
  taxRate: number; // percent
}

export interface CalcLineResult extends CalcLineInput {
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

/** Per-line subtotal/tax/total. Tax is charged on the pre-discount line value. */
export function calcLine(item: CalcLineInput): CalcLineResult {
  const lineSubtotal = round2(item.quantity * item.unitPrice);
  const lineTax = round2(lineSubtotal * (item.taxRate / 100));
  const lineTotal = round2(lineSubtotal + lineTax);
  return { ...item, lineSubtotal, lineTax, lineTotal };
}

export interface CalcInvoiceInput {
  lineItems: CalcLineInput[];
  discountType: "NONE" | "PERCENTAGE" | "FIXED";
  discountValue: number;
}

export interface CalcInvoiceResult {
  lines: CalcLineResult[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Invoice money model:
 *   subtotal      = Σ line subtotals (qty × price)
 *   discountTotal = % of subtotal, or a fixed amount (capped at subtotal)
 *   taxTotal      = Σ per-line tax (computed on pre-discount line value)
 *   total         = subtotal − discount + tax
 */
export function calcInvoice(input: CalcInvoiceInput): CalcInvoiceResult {
  const lines = input.lineItems.map(calcLine);
  const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.lineTax, 0));

  let discountTotal = 0;
  if (input.discountType === "PERCENTAGE") {
    discountTotal = round2(subtotal * (input.discountValue / 100));
  } else if (input.discountType === "FIXED") {
    discountTotal = round2(Math.min(input.discountValue, subtotal));
  }

  const total = round2(subtotal - discountTotal + taxTotal);
  return { lines, subtotal, discountTotal, taxTotal, total };
}
