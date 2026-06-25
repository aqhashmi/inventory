import { z } from "zod";

const optionalString = z.string().max(200).optional().or(z.literal(""));

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: optionalString,

  billingAddressLine1: optionalString,
  billingAddressLine2: optionalString,
  billingCity: optionalString,
  billingState: optionalString,
  billingPostalCode: optionalString,
  billingCountry: optionalString,

  shippingAddressLine1: optionalString,
  shippingAddressLine2: optionalString,
  shippingCity: optionalString,
  shippingState: optionalString,
  shippingPostalCode: optionalString,
  shippingCountry: optionalString,

  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;
