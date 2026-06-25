import { z } from "zod";

const optionalString = z.string().max(200).optional().or(z.literal(""));

export const organizationSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: optionalString,
  website: optionalString,
  taxId: optionalString,
  logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
  currency: z.string().min(3).max(3).default("USD"),
  invoicePrefix: z.string().min(1).max(10).default("INV-"),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
