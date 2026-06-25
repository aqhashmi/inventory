"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateOrganization } from "@/lib/actions/organization";
import {
  organizationSchema,
  type OrganizationInput,
} from "@/lib/validations/organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  defaultValues,
}: {
  defaultValues: OrganizationInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationInput>({
    resolver: zodResolver(organizationSchema),
    defaultValues,
  });

  async function onSubmit(values: OrganizationInput) {
    setServerError(null);
    const result = await updateOrganization(values);
    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof OrganizationInput, { message: messages?.[0] });
        }
      }
      setServerError(result.error);
      return;
    }
    toast.success(result.message ?? "Saved.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Phone">
            <Input {...register("phone")} />
          </Field>
          <Field label="Website" error={errors.website?.message}>
            <Input {...register("website")} />
          </Field>
          <Field label="Tax ID">
            <Input {...register("taxId")} />
          </Field>
          <Field label="Logo URL" error={errors.logoUrl?.message}>
            <Input {...register("logoUrl")} placeholder="https://…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1">
            <Input {...register("addressLine1")} />
          </Field>
          <Field label="Address line 2">
            <Input {...register("addressLine2")} />
          </Field>
          <Field label="City">
            <Input {...register("city")} />
          </Field>
          <Field label="State / Province">
            <Input {...register("state")} />
          </Field>
          <Field label="Postal code">
            <Input {...register("postalCode")} />
          </Field>
          <Field label="Country">
            <Input {...register("country")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoicing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Currency (3-letter)"
            error={errors.currency?.message}
          >
            <Input {...register("currency")} maxLength={3} placeholder="USD" />
          </Field>
          <Field label="Invoice prefix" error={errors.invoicePrefix?.message}>
            <Input {...register("invoicePrefix")} placeholder="INV-" />
          </Field>
          <Field
            label="Default tax rate (%)"
            error={errors.defaultTaxRate?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...register("defaultTaxRate", { valueAsNumber: true })}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
