import { PrismaClient, type DiscountType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@invoflow.app";
const DEMO_PASSWORD = "password123";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calcInvoice(
  lines: { quantity: number; unitPrice: number; taxRate: number }[],
  discountType: DiscountType,
  discountValue: number,
) {
  const computed = lines.map((l) => {
    const lineSubtotal = round2(l.quantity * l.unitPrice);
    const lineTax = round2(lineSubtotal * (l.taxRate / 100));
    return { ...l, lineSubtotal, lineTax, lineTotal: round2(lineSubtotal + lineTax) };
  });
  const subtotal = round2(computed.reduce((s, l) => s + l.lineSubtotal, 0));
  const taxTotal = round2(computed.reduce((s, l) => s + l.lineTax, 0));
  let discountTotal = 0;
  if (discountType === "PERCENTAGE") discountTotal = round2(subtotal * (discountValue / 100));
  else if (discountType === "FIXED") discountTotal = round2(Math.min(discountValue, subtotal));
  const total = round2(subtotal - discountTotal + taxTotal);
  return { computed, subtotal, taxTotal, discountTotal, total };
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("🌱 Seeding…");

  // Start clean: remove any existing demo org (cascades to all its data).
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { organizationId: true },
  });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.organizationId } });
    console.log("   Removed previous demo organization.");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const org = await prisma.organization.create({
    data: {
      name: "Acme Supplies Co.",
      email: "billing@acmesupplies.example",
      phone: "+1 (555) 010-2030",
      website: "https://acmesupplies.example",
      taxId: "US-123456789",
      addressLine1: "120 Market Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "USA",
      currency: "USD",
      invoicePrefix: "INV-",
      defaultTaxRate: 7.5,
      users: {
        create: {
          name: "Demo Owner",
          email: DEMO_EMAIL,
          passwordHash,
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });
  const userId = org.users[0].id;
  const organizationId = org.id;

  // Categories
  const [hardware, office, packaging] = await Promise.all([
    prisma.category.create({ data: { organizationId, name: "Hardware" } }),
    prisma.category.create({ data: { organizationId, name: "Office Supplies" } }),
    prisma.category.create({ data: { organizationId, name: "Packaging" } }),
  ]);

  // Products (with opening-stock adjustments)
  const productSeeds = [
    { sku: "HW-001", name: "Cordless Drill 18V", categoryId: hardware.id, unitPrice: 129.99, costPrice: 78.0, qty: 40, reorder: 10, tax: 7.5, uom: "unit" },
    { sku: "HW-002", name: 'Hex Bolt M8 x 40mm (100pk)', categoryId: hardware.id, unitPrice: 12.5, costPrice: 5.25, qty: 8, reorder: 20, tax: 7.5, uom: "box" },
    { sku: "OF-101", name: "Printer Paper A4 (500 sheets)", categoryId: office.id, unitPrice: 8.99, costPrice: 3.4, qty: 200, reorder: 50, tax: 0, uom: "ream" },
    { sku: "OF-102", name: "Gel Pens Assorted (12pk)", categoryId: office.id, unitPrice: 6.49, costPrice: 2.1, qty: 15, reorder: 25, tax: 0, uom: "pack" },
    { sku: "PK-201", name: "Shipping Box Medium", categoryId: packaging.id, unitPrice: 1.75, costPrice: 0.6, qty: 500, reorder: 100, tax: 7.5, uom: "unit" },
    { sku: "PK-202", name: "Bubble Wrap Roll 50m", categoryId: packaging.id, unitPrice: 24.0, costPrice: 11.0, qty: 30, reorder: 10, tax: 7.5, uom: "roll" },
  ];

  const products: Awaited<ReturnType<typeof prisma.product.create>>[] = [];
  for (const p of productSeeds) {
    const product = await prisma.product.create({
      data: {
        organizationId,
        sku: p.sku,
        name: p.name,
        categoryId: p.categoryId,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        quantityOnHand: p.qty,
        reorderLevel: p.reorder,
        taxRate: p.tax,
        unitOfMeasure: p.uom,
      },
    });
    await prisma.stockAdjustment.create({
      data: {
        organizationId,
        productId: product.id,
        type: "INITIAL",
        quantityChange: p.qty,
        previousQuantity: 0,
        newQuantity: p.qty,
        reason: "Opening stock",
        createdById: userId,
      },
    });
    products.push(product);
  }

  // Customers
  const [globex, initech, umbrella] = await Promise.all([
    prisma.customer.create({
      data: {
        organizationId,
        name: "Globex Corporation",
        email: "ap@globex.example",
        phone: "+1 (555) 200-1000",
        billingAddressLine1: "500 Industrial Pkwy",
        billingCity: "Austin",
        billingState: "TX",
        billingPostalCode: "73301",
        billingCountry: "USA",
      },
    }),
    prisma.customer.create({
      data: {
        organizationId,
        name: "Initech LLC",
        email: "accounts@initech.example",
        phone: "+1 (555) 300-2000",
        billingAddressLine1: "77 Cubicle Lane",
        billingCity: "Dallas",
        billingState: "TX",
        billingPostalCode: "75201",
        billingCountry: "USA",
      },
    }),
    prisma.customer.create({
      data: {
        organizationId,
        name: "Umbrella Retail",
        email: "finance@umbrella.example",
        billingAddressLine1: "1 Raccoon Plaza",
        billingCity: "Seattle",
        billingState: "WA",
        billingPostalCode: "98101",
        billingCountry: "USA",
      },
    }),
  ]);

  let counter = 0;
  const productByIndex = (i: number) => products[i];

  // Helper to create a finalized invoice that deducts stock.
  async function createInvoice(opts: {
    customerId: string;
    issueDate: Date;
    dueDate: Date;
    status: "DRAFT" | "SENT" | "PAID";
    lines: { productIndex: number; quantity: number }[];
    discountType?: DiscountType;
    discountValue?: number;
    payFull?: boolean;
    payPartial?: number;
  }) {
    const lineInputs = opts.lines.map((l) => {
      const product = productByIndex(l.productIndex);
      return {
        productId: product.id,
        description: product.name,
        quantity: l.quantity,
        unitPrice: Number(product.unitPrice),
        taxRate: Number(product.taxRate),
      };
    });
    const totals = calcInvoice(
      lineInputs,
      opts.discountType ?? "NONE",
      opts.discountValue ?? 0,
    );
    const finalize = opts.status !== "DRAFT";
    counter += 1;
    const number = `INV-${String(counter).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        number,
        currency: "USD",
        customerId: opts.customerId,
        status: opts.status,
        finalizedAt: finalize ? opts.issueDate : null,
        issueDate: opts.issueDate,
        dueDate: opts.dueDate,
        paymentTerms: "Net 30",
        discountType: opts.discountType ?? "NONE",
        discountValue: opts.discountValue ?? 0,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        lineItems: {
          create: lineInputs.map((l, idx) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            lineSubtotal: totals.computed[idx].lineSubtotal,
            lineTax: totals.computed[idx].lineTax,
            lineTotal: totals.computed[idx].lineTotal,
            sortOrder: idx,
          })),
        },
      },
    });

    if (finalize) {
      for (const l of opts.lines) {
        const product = productByIndex(l.productIndex);
        const fresh = await prisma.product.findUniqueOrThrow({
          where: { id: product.id },
          select: { quantityOnHand: true },
        });
        const newQty = fresh.quantityOnHand - l.quantity;
        await prisma.product.update({
          where: { id: product.id },
          data: { quantityOnHand: newQty },
        });
        await prisma.stockAdjustment.create({
          data: {
            organizationId,
            productId: product.id,
            type: "SALE",
            quantityChange: -l.quantity,
            previousQuantity: fresh.quantityOnHand,
            newQuantity: newQty,
            reason: `Invoice ${number}`,
            reference: number,
            createdById: userId,
          },
        });
      }
    }

    const payAmount = opts.payFull
      ? totals.total
      : opts.payPartial ?? 0;
    if (payAmount > 0) {
      await prisma.payment.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          amount: payAmount,
          method: "BANK_TRANSFER",
          paidAt: opts.issueDate,
          reference: "SEED-PAY",
        },
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: payAmount },
      });
    }

    return invoice;
  }

  // A spread of invoices across the last few months and statuses.
  await createInvoice({
    customerId: globex.id,
    issueDate: daysFromNow(-95),
    dueDate: daysFromNow(-65),
    status: "PAID",
    lines: [
      { productIndex: 0, quantity: 3 },
      { productIndex: 4, quantity: 50 },
    ],
    payFull: true,
  });
  await createInvoice({
    customerId: initech.id,
    issueDate: daysFromNow(-60),
    dueDate: daysFromNow(-30),
    status: "PAID",
    lines: [{ productIndex: 2, quantity: 40 }],
    discountType: "PERCENTAGE",
    discountValue: 10,
    payFull: true,
  });
  await createInvoice({
    customerId: umbrella.id,
    issueDate: daysFromNow(-25),
    dueDate: daysFromNow(5),
    status: "SENT",
    lines: [
      { productIndex: 5, quantity: 4 },
      { productIndex: 1, quantity: 2 },
    ],
    payPartial: 40,
  });
  await createInvoice({
    customerId: globex.id,
    issueDate: daysFromNow(-40),
    dueDate: daysFromNow(-10), // past due -> shows as OVERDUE
    status: "SENT",
    lines: [{ productIndex: 0, quantity: 1 }],
  });
  await createInvoice({
    customerId: initech.id,
    issueDate: daysFromNow(-2),
    dueDate: daysFromNow(28),
    status: "DRAFT",
    lines: [
      { productIndex: 3, quantity: 5 },
      { productIndex: 2, quantity: 10 },
    ],
  });

  console.log("✅ Seed complete.");
  console.log(`   Login:  ${DEMO_EMAIL}`);
  console.log(`   Pass:   ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
