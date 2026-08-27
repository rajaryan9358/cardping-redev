import { supabase } from "../client";

export interface TopupPackageRow {
  id: string;
  coins: number;
  price_inr: number;
  description: string | null;
  benefits: string[];
  is_popular: boolean;
  is_active: boolean;
  tag: string | null;
  is_default: boolean;
}

const COLUMNS = "id, coins, price_inr, description, benefits, is_popular, is_active, tag, is_default";

async function listActive(): Promise<TopupPackageRow[]> {
  const { data, error } = await supabase.from("topup_packages").select(COLUMNS).eq("is_active", true).order("price_inr", { ascending: true });
  if (error) throw error;
  return data as TopupPackageRow[];
}

async function findById(id: string): Promise<TopupPackageRow | null> {
  const { data, error } = await supabase.from("topup_packages").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as TopupPackageRow | null;
}

export const topupPackagesRepo = { listActive, findById };
