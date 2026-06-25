"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export interface CustomerRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  notes: string | null;
}

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerRecord | null;
  /** Called with the new customer after a successful create. */
  onCreated?: (customer: { id: string; name: string }) => void;
}

const emptyDefaults: CustomerInput = {
  name: "",
  email: "",
  phone: "",
  billingAddressLine1: "",
  billingAddressLine2: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountry: "",
  shippingAddressLine1: "",
  shippingAddressLine2: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  notes: "",
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onCreated,
}: CustomerFormDialogProps) {
  const isEdit = Boolean(customer);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (customer) {
      reset(
        Object.fromEntries(
          Object.entries(customer)
            .filter(([k]) => k !== "id")
            .map(([k, v]) => [k, v ?? ""]),
        ) as CustomerInput,
      );
    } else {
      reset(emptyDefaults);
    }
  }, [open, customer, reset]);

  function copyBillingToShipping() {
    const v = getValues();
    setValue("shippingAddressLine1", v.billingAddressLine1 ?? "");
    setValue("shippingAddressLine2", v.billingAddressLine2 ?? "");
    setValue("shippingCity", v.billingCity ?? "");
    setValue("shippingState", v.billingState ?? "");
    setValue("shippingPostalCode", v.billingPostalCode ?? "");
    setValue("shippingCountry", v.billingCountry ?? "");
  }

  async function onSubmit(values: CustomerInput) {
    setServerError(null);
    const result = isEdit
      ? await updateCustomer(customer!.id, values)
      : await createCustomer(values);
    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CustomerInput, { message: messages?.[0] });
        }
      }
      setServerError(result.error);
      return;
    }
    toast.success(result.message ?? "Saved.");
    onOpenChange(false);
    if (!isEdit && result.success && "data" in result && result.data) {
      onCreated?.({ id: result.data.id, name: values.name });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Contact and address details used on invoices.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" error={errors.name?.message} className="sm:col-span-1">
              <Input {...register("name")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="Phone">
              <Input {...register("phone")} />
            </Field>
          </div>

          <Separator />
          <p className="text-sm font-medium">Billing address</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1">
              <Input {...register("billingAddressLine1")} />
            </Field>
            <Field label="Address line 2">
              <Input {...register("billingAddressLine2")} />
            </Field>
            <Field label="City">
              <Input {...register("billingCity")} />
            </Field>
            <Field label="State / Province">
              <Input {...register("billingState")} />
            </Field>
            <Field label="Postal code">
              <Input {...register("billingPostalCode")} />
            </Field>
            <Field label="Country">
              <Input {...register("billingCountry")} />
            </Field>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Shipping address</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyBillingToShipping}
            >
              Copy from billing
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1">
              <Input {...register("shippingAddressLine1")} />
            </Field>
            <Field label="Address line 2">
              <Input {...register("shippingAddressLine2")} />
            </Field>
            <Field label="City">
              <Input {...register("shippingCity")} />
            </Field>
            <Field label="State / Province">
              <Input {...register("shippingState")} />
            </Field>
            <Field label="Postal code">
              <Input {...register("shippingPostalCode")} />
            </Field>
            <Field label="Country">
              <Input {...register("shippingCountry")} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea {...register("notes")} rows={2} />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
