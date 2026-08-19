import { supabase } from "../client";

export interface PlanRow {
  id: string;
  name: string;
  price_inr: number;
  period_days: number;
  coins_included: number;
  description: string | null;
  benefits: string[];
  is_active: boolean;
}

async function listActive(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_inr, period_days, coins_included, description, benefits, is_active")
    .eq("is_active", true)
    .order("price_inr", { ascending: true });
  if (error) throw error;
  return data as PlanRow[];
}

async function findById(id: string): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_inr, period_days, coins_included, description, benefits, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as PlanRow | null;
}

export const plansRepo = { listActive, findById };
