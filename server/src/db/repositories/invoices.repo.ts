import { supabase } from "../client";

export interface InvoiceRow {
  id: string;
  account_id: string;
  transaction_id: string;
  invoice_number: string;
  buyer_gstin: string | null;
  amount: number;
  tax_amount: number;
  pdf_path: string | null;
  created_at: string;
}

async function create(input: {
  accountId: string;
  transactionId: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  pdfPath: string;
}): Promise<InvoiceRow> {
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      account_id: input.accountId,
      transaction_id: input.transactionId,
      invoice_number: input.invoiceNumber,
      amount: input.amount,
      tax_amount: input.taxAmount,
      pdf_path: input.pdfPath,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as InvoiceRow;
}

async function countThisMonth(yearMonth: string): Promise<number> {
  const { count, error } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .like("invoice_number", `INV-${yearMonth}-%`);
  if (error) throw error;
  return count ?? 0;
}

async function listForAccount(accountId: string): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as InvoiceRow[];
}

async function findByIdForAccount(id: string, accountId: string): Promise<InvoiceRow | null> {
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).eq("account_id", accountId).maybeSingle();
  if (error) throw error;
  return data as InvoiceRow | null;
}

export const invoicesRepo = { create, countThisMonth, listForAccount, findByIdForAccount };
