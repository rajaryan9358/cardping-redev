import PDFDocument from "pdfkit";
import { supabase } from "../db/client";
import { invoicesRepo, InvoiceRow } from "../db/repositories/invoices.repo";
import { Account, Transaction } from "../types/domain";

function buildInvoiceNumber(seq: number, yearMonth: string): string {
  return `INV-${yearMonth}-${String(seq).padStart(4, "0")}`;
}

function renderPdf(input: { invoiceNumber: string; account: Account; description: string; amount: number; taxAmount: number; date: Date }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("CardPing", { continued: true }).fontSize(10).text("  Invoice", { align: "left" });
    doc.moveDown(1.5);
    doc.fontSize(10).fillColor("#666").text(`Invoice #${input.invoiceNumber}`);
    doc.text(`Date: ${input.date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`);
    doc.moveDown(1);
    doc.fillColor("#000").fontSize(12).text("Billed to:");
    doc.fontSize(10).fillColor("#666").text(input.account.full_name ?? input.account.email ?? input.account.id);
    if (input.account.email) doc.text(input.account.email);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.fillColor("#000").fontSize(10).text("Description", 50, tableTop).text("Amount (INR)", 400, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#ddd").stroke();
    doc.text(input.description, 50, tableTop + 25).text(input.amount.toFixed(2), 400, tableTop + 25);

    const totalTop = tableTop + 60;
    doc.moveTo(50, totalTop).lineTo(545, totalTop).strokeColor("#ddd").stroke();
    doc.fontSize(10).text("Tax", 50, totalTop + 10).text(input.taxAmount.toFixed(2), 400, totalTop + 10);
    doc.fontSize(12).text("Total", 50, totalTop + 30).text((input.amount + input.taxAmount).toFixed(2), 400, totalTop + 30);

    doc.end();
  });
}

/** Generates and stores an invoice PDF for a completed billing
 * transaction — called from the Cashfree webhook once payment succeeds.
 * Invoice numbers are `INV-{yyyymm}-{seq}`, computed from a count query
 * rather than a DB sequence/trigger (a small race window is acceptable
 * for invoice numbering, unlike money-affecting logic like coin
 * balances, which correctly use atomic RPCs instead). */
export async function generateForTransaction(transaction: Transaction, account: Account, description: string): Promise<InvoiceRow> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seq = (await invoicesRepo.countThisMonth(yearMonth)) + 1;
  const invoiceNumber = buildInvoiceNumber(seq, yearMonth);
  const amount = transaction.amount_inr ?? 0;

  const pdfBuffer = await renderPdf({ invoiceNumber, account, description, amount, taxAmount: 0, date: now });
  const pdfPath = `${account.id}/${invoiceNumber}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;

  return invoicesRepo.create({
    accountId: account.id,
    transactionId: transaction.id,
    invoiceNumber,
    amount,
    taxAmount: 0,
    pdfPath,
  });
}
