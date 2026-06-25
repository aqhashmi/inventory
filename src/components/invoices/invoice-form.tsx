"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import { calcInvoice } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";

export interface CustomerOption {
  id: string;
  name: string;
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  taxRate: number;
  quantityOnHand: number;
  unitOfMeasure: string;
}

interface LineItemForm {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface InvoiceFormValues {
  customerId: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  terms: string;
  discountType: "NONE" | "PERCENTAGE" | "FIXED";
  discountValue: number;
  lineItems: LineItemForm[];
}

interface InvoiceFormProps {
  customers: CustomerOption[];
  products: ProductOption[];
  currency: string;
  mode: "create" | "edit";
  invoiceId?: string;
  defaultValues?: InvoiceFormValues;
}

const NONE_PRODUCT = "__custom__";

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return toDateInput(d);
}

export function InvoiceForm({
  customers: initialCustomers,
  products,
  currency,
  mode,
  invoiceId,
  defaultValues,
}: InvoiceFormProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "draft" | "finalize" | "save" | null
  >(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
  } = useForm<InvoiceFormValues>({
    defaultValues:
      defaultValues ??
      ({
        customerId: "",
        issueDate: toDateInput(new Date()),
        dueDate: defaultDueDate(),
        paymentTerms: "Net 30",
        notes: "",
        terms: "",
        discountType: "NONE",
        discountValue: 0,
        lineItems: [
          { productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
        ],
      } satisfies InvoiceFormValues),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchedLines = watch("lineItems");
  const discountType = watch("discountType");
  const discountValue = watch("discountValue");
  const customerId = watch("customerId");

  const totals = useMemo(
    () =>
      calcInvoice({
        lineItems: (watchedLines ?? []).map((l) => ({
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          taxRate: Number(l.taxRate) || 0,
        })),
        discountType: discountType ?? "NONE",
        discountValue: Number(discountValue) || 0,
      }),
    [watchedLines, discountType, discountValue],
  );

  function onSelectProduct(index: number, productId: string) {
    if (productId === NONE_PRODUCT) {
      setValue(`lineItems.${index}.productId`, "");
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setValue(`lineItems.${index}.productId`, product.id);
    setValue(`lineItems.${index}.description`, product.name);
    setValue(`lineItems.${index}.unitPrice`, product.unitPrice);
    setValue(`lineItems.${index}.taxRate`, product.taxRate);
  }

  async function submit(values: InvoiceFormValues, finalize: boolean) {
    setServerError(null);
    if (!values.customerId) {
      setServerError("Please select a customer.");
      return;
    }
    setPendingAction(mode === "edit" ? "save" : finalize ? "finalize" : "draft");
    const result =
      mode === "edit"
        ? await updateInvoice(invoiceId!, values)
        : await createInvoice(values, finalize);
    setPendingAction(null);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    toast.success(result.message ?? "Saved.");
    if (mode === "edit") {
      router.push(`/invoices/${invoiceId}`);
    } else if ("data" in result && result.data) {
      router.push(`/invoices/${result.data.id}`);
    } else {
      router.push("/invoices");
    }
    router.refresh();
  }

  return (
    <form className="space-y-6">
      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Customer</Label>
            <div className="flex gap-2">
              <Select
                value={customerId}
                onValueChange={(v) => setValue("customerId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomerDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Issue date</Label>
            <Input type="date" {...register("issueDate")} />
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" {...register("dueDate")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Payment terms</Label>
            <Input
              {...register("paymentTerms")}
              placeholder="e.g. Net 30, Due on receipt"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                productId: "",
                description: "",
                quantity: 1,
                unitPrice: 0,
                taxRate: 0,
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const line = watchedLines?.[index];
            const lineTotal =
              (Number(line?.quantity) || 0) * (Number(line?.unitPrice) || 0);
            const selectedProductId = line?.productId || NONE_PRODUCT;
            return (
              <div
                key={field.id}
                className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-12 sm:items-end"
              >
                <div className="col-span-2 space-y-1 sm:col-span-4">
                  <Label className="text-xs">Product / item</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={(v) => onSelectProduct(index, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_PRODUCT}>
                        Custom item (no product)
                      </SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.quantityOnHand} {p.unitOfMeasure})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-1"
                    placeholder="Description"
                    {...register(`lineItems.${index}.description`)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register(`lineItems.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Unit price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`lineItems.${index}.unitPrice`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Tax %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`lineItems.${index}.taxRate`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex items-center justify-between sm:col-span-2 sm:justify-end sm:gap-2">
                  <span className="text-sm font-medium">
                    {formatCurrency(lineTotal, currency)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes & terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Notes (visible to customer)</Label>
              <Textarea {...register("notes")} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Terms</Label>
              <Textarea {...register("terms")} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) =>
                    setValue(
                      "discountType",
                      v as InvoiceFormValues["discountType"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FIXED">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount value</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={discountType === "NONE"}
                  {...register("discountValue", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-1 border-t pt-3 text-sm">
              <Row label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
              {totals.discountTotal > 0 && (
                <Row
                  label="Discount"
                  value={`− ${formatCurrency(totals.discountTotal, currency)}`}
                />
              )}
              <Row label="Tax" value={formatCurrency(totals.taxTotal, currency)} />
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totals.total, currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pendingAction !== null}
        >
          Cancel
        </Button>
        {mode === "create" ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSubmit((v) => submit(v, false))}
              disabled={pendingAction !== null}
            >
              {pendingAction === "draft" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save as draft
            </Button>
            <Button
              type="button"
              onClick={handleSubmit((v) => submit(v, true))}
              disabled={pendingAction !== null}
            >
              {pendingAction === "finalize" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save & finalize
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit((v) => submit(v, false))}
            disabled={pendingAction !== null}
          >
            {pendingAction === "save" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        )}
      </div>

      <CustomerFormDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onCreated={({ id, name }) => {
          // Add to the local list and select it immediately.
          setCustomers((prev) =>
            prev.some((c) => c.id === id) ? prev : [...prev, { id, name }],
          );
          setValue("customerId", id);
          router.refresh();
        }}
      />
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
