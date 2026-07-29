// Our own branded PDF invoice — distinct from the furniture shop API's own
// GET /orders/{order_id}/invoice (which is real and works, but is their
// generic document, not ours to restyle). This one is generated entirely
// on our side from order data we already have, styled to match the app's
// actual colour tokens (globals.css) rather than an unrelated palette.

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// Mirrors the CSS custom properties in src/app/globals.css — kept in sync
// by hand since @react-pdf/renderer can't read CSS variables at build time.
const colors = {
  background: "#ffffff",
  foreground: "#4a3f35",
  primary: "#e2795a",
  primaryForeground: "#ffffff",
  accent: "#7fa87a",
  muted: "#f3e9dd",
  mutedForeground: "#8a7c6e",
  border: "#eee1d2",
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: "Helvetica",
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    paddingHorizontal: 40,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { fontSize: 20, fontWeight: 700 },
  invoiceLabel: { fontSize: 12, letterSpacing: 2, opacity: 0.9 },
  body: { padding: 40 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  metaBlock: { flexDirection: "column", gap: 2 },
  metaLabel: { fontSize: 9, color: colors.mutedForeground, textTransform: "uppercase" },
  metaValue: { fontSize: 11, marginTop: 2 },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    marginBottom: 24,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.muted,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  colItem: { flex: 3, fontSize: 10 },
  colQty: { flex: 1, fontSize: 10, textAlign: "right" },
  colPrice: { flex: 1, fontSize: 10, textAlign: "right" },
  colTotal: { flex: 1, fontSize: 10, textAlign: "right" },
  headerCell: { fontSize: 9, color: colors.mutedForeground, textTransform: "uppercase" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 11, marginRight: 12 },
  totalValue: { fontSize: 14, fontWeight: 700, color: colors.accent },
  footer: {
    marginTop: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: { fontSize: 9, color: colors.mutedForeground },
});

export type InvoiceData = {
  orderId: string;
  timestamp: string;
  customerEmail: string;
  items: { productName: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
};

function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document title={`Comfy Land Invoice ${data.orderId}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>🛋️ Comfy Land</Text>
          <Text style={styles.invoiceLabel}>INVOICE</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Billed to</Text>
              <Text style={styles.metaValue}>{data.customerEmail}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Order ID</Text>
              <Text style={styles.metaValue}>{data.orderId}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>
                {new Date(data.timestamp).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colItem, styles.headerCell]}>Item</Text>
              <Text style={[styles.colQty, styles.headerCell]}>Qty</Text>
              <Text style={[styles.colPrice, styles.headerCell]}>Unit price</Text>
              <Text style={[styles.colTotal, styles.headerCell]}>Total</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colItem}>{item.productName}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>${item.unitPrice.toFixed(2)}</Text>
                <Text style={styles.colTotal}>
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${data.totalAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Thank you for shopping with Comfy Land. This invoice was generated from your order
              history and reflects the amount charged at the time of purchase.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
