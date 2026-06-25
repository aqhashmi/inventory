"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createProduct, updateProduct } from "@/lib/actions/products";
import {
  productSchema,
  productUpdateSchema,
  type ProductInput,
} from "@/lib/validations/product";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ProductFormValues extends ProductInput {}

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  /** Present when editing. */
  product?: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    unitPrice: number;
    costPrice: number;
    quantityOnHand: number;
    reorderLevel: number;
    unitOfMeasure: string;
    taxRate: number;
    isActive: boolean;
  };
}

const NONE = "__none__";

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
}: ProductFormDialogProps) {
  const isEdit = Boolean(product);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(isEdit ? productUpdateSchema : productSchema) as never,
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      categoryId: "",
      unitPrice: 0,
      costPrice: 0,
      quantityOnHand: 0,
      reorderLevel: 0,
      unitOfMeasure: "unit",
      taxRate: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    reset({
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? "",
      unitPrice: product?.unitPrice ?? 0,
      costPrice: product?.costPrice ?? 0,
      quantityOnHand: product?.quantityOnHand ?? 0,
      reorderLevel: product?.reorderLevel ?? 0,
      unitOfMeasure: product?.unitOfMeasure ?? "unit",
      taxRate: product?.taxRate ?? 0,
      isActive: product?.isActive ?? true,
    });
  }, [open, product, reset]);

  const categoryId = watch("categoryId");

  async function onSubmit(values: ProductFormValues) {
    setServerError(null);
    const result = isEdit
      ? await updateProduct(product!.id, values)
      : await createProduct(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ProductFormValues, { message: messages?.[0] });
        }
      }
      setServerError(result.error);
      return;
    }
    toast.success(result.message ?? "Saved.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details. To change stock, use “Adjust stock”."
              : "Add a new item to your inventory."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" error={errors.sku?.message}>
              <Input {...register("sku")} placeholder="SKU-001" />
            </Field>
            <Field label="Name" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Widget" />
            </Field>
          </div>

          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} rows={2} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={categoryId ? categoryId : NONE}
                onValueChange={(v) =>
                  setValue("categoryId", v === NONE ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Unit of measure" error={errors.unitOfMeasure?.message}>
              <Input {...register("unitOfMeasure")} placeholder="unit, kg, box" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unit price" error={errors.unitPrice?.message}>
              <Input
                type="number"
                step="0.01"
                {...register("unitPrice", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Cost price" error={errors.costPrice?.message}>
              <Input
                type="number"
                step="0.01"
                {...register("costPrice", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Tax rate (%)" error={errors.taxRate?.message}>
              <Input
                type="number"
                step="0.01"
                {...register("taxRate", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isEdit && (
              <Field
                label="Opening quantity"
                error={errors.quantityOnHand?.message}
              >
                <Input
                  type="number"
                  {...register("quantityOnHand", { valueAsNumber: true })}
                />
              </Field>
            )}
            <Field label="Reorder level" error={errors.reorderLevel?.message}>
              <Input
                type="number"
                {...register("reorderLevel", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox {...register("isActive")} />
            Active (available for invoicing)
          </label>

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
              {isEdit ? "Save changes" : "Create product"}
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
