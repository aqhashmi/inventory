"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";

import { importProducts } from "@/lib/actions/products";
import { csvToObjects, PRODUCT_CSV_TEMPLATE } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportSummary {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setSummary(null);
    setParseError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    setParseError(null);
    try {
      const text = await file.text();
      const parsed = csvToObjects(text);
      if (parsed.length === 0) {
        setParseError("No data rows found in the file.");
        setRows([]);
        return;
      }
      if (!("sku" in parsed[0]) || !("name" in parsed[0])) {
        setParseError(
          "CSV must include at least 'sku' and 'name' header columns.",
        );
        setRows([]);
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("Could not read the file.");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setSubmitting(true);
    const result = await importProducts(rows);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSummary(result.data ?? { created: 0, updated: 0, errors: [] });
    toast.success(result.message ?? "Import complete.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
          <DialogDescription>
            Existing products are matched by SKU and updated. New SKUs are
            created. Categories are created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4" />
            Download template
          </Button>

          <div className="rounded-md border border-dashed p-4">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {fileName && rows.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {fileName}: {rows.length} row{rows.length === 1 ? "" : "s"} ready
                to import.
              </p>
            )}
          </div>

          {parseError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </div>
          )}

          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
              <p>
                <span className="font-medium text-emerald-600">
                  {summary.created}
                </span>{" "}
                created,{" "}
                <span className="font-medium text-blue-600">
                  {summary.updated}
                </span>{" "}
                updated.
              </p>
              {summary.errors.length > 0 && (
                <div className="text-destructive">
                  <p className="font-medium">
                    {summary.errors.length} row(s) skipped:
                  </p>
                  <ul className="mt-1 max-h-32 list-inside list-disc overflow-auto">
                    {summary.errors.map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            {summary ? "Close" : "Cancel"}
          </Button>
          {!summary && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Import {rows.length > 0 ? `${rows.length} rows` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
