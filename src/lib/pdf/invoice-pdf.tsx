import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export interface InvoicePdfData {
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  paymentTerms?: string | null;
  notes?: string | null;
  terms?: string | null;
  org: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address: string;
    taxId?: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    address: string;
  };
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  partyBlock: { width: "48%" },
  sectionLabel: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 6,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  cellDesc: { width: "46%" },
  cellQty: { width: "12%", textAlign: "right" },
  cellPrice: { width: "16%", textAlign: "right" },
  cellTax: { width: "10%", textAlign: "right" },
  cellAmount: { width: "16%", textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: "45%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    marginTop: 4,
    paddingTop: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  footer: { marginTop: 28 },
  badge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
});

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const { currency } = data;
  return (
    <Document title={`Invoice ${data.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.bold}>{data.org.name}</Text>
            {data.org.address ? (
              <Text style={styles.muted}>{data.org.address}</Text>
            ) : null}
            {data.org.email ? (
              <Text style={styles.muted}>{data.org.email}</Text>
            ) : null}
            {data.org.phone ? (
              <Text style={styles.muted}>{data.org.phone}</Text>
            ) : null}
            {data.org.taxId ? (
              <Text style={styles.muted}>Tax ID: {data.org.taxId}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.muted}>{data.number}</Text>
            <Text style={styles.badge}>{data.status}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.sectionLabel}>Bill to</Text>
            <Text style={styles.bold}>{data.customer.name}</Text>
            {data.customer.email ? (
              <Text style={styles.muted}>{data.customer.email}</Text>
            ) : null}
            {data.customer.address ? (
              <Text style={styles.muted}>{data.customer.address}</Text>
            ) : null}
          </View>
          <View style={[styles.partyBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.sectionLabel}>Details</Text>
            <Text>Issue date: {data.issueDate}</Text>
            <Text>Due date: {data.dueDate}</Text>
            {data.paymentTerms ? (
              <Text>Terms: {data.paymentTerms}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cellDesc, styles.bold]}>Description</Text>
            <Text style={[styles.cellQty, styles.bold]}>Qty</Text>
            <Text style={[styles.cellPrice, styles.bold]}>Unit price</Text>
            <Text style={[styles.cellTax, styles.bold]}>Tax</Text>
            <Text style={[styles.cellAmount, styles.bold]}>Amount</Text>
          </View>
          {data.lineItems.map((l, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.cellDesc}>{l.description}</Text>
              <Text style={styles.cellQty}>{l.quantity}</Text>
              <Text style={styles.cellPrice}>{money(l.unitPrice, currency)}</Text>
              <Text style={styles.cellTax}>{l.taxRate}%</Text>
              <Text style={styles.cellAmount}>{money(l.lineTotal, currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{money(data.subtotal, currency)}</Text>
          </View>
          {data.discountTotal > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Discount</Text>
              <Text>− {money(data.discountTotal, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Tax</Text>
            <Text>{money(data.taxTotal, currency)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{money(data.total, currency)}</Text>
          </View>
          {data.amountPaid > 0 ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Paid</Text>
                <Text>{money(data.amountPaid, currency)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.bold}>Balance due</Text>
                <Text style={styles.bold}>{money(data.balance, currency)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {data.notes || data.terms ? (
          <View style={styles.footer}>
            {data.notes ? (
              <>
                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.muted}>{data.notes}</Text>
              </>
            ) : null}
            {data.terms ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
                  Terms
                </Text>
                <Text style={styles.muted}>{data.terms}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
