import { supabase } from "../client";
import { TempEmail } from "../../types/domain";

async function create(input: {
  to: string;
  from: string | null;
  subject: string;
  body: string;
  visitingCardId: string;
}): Promise<TempEmail> {
  const { data, error } = await supabase
    .from("temp_emails")
    .insert({
      to: input.to,
      from: input.from,
      subject: input.subject,
      body: input.body,
      visiting_card_id: input.visitingCardId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TempEmail;
}

async function findLatestByVisitingCardId(visitingCardId: string): Promise<TempEmail | null> {
  const { data, error } = await supabase
    .from("temp_emails")
    .select("*")
    .eq("visiting_card_id", visitingCardId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as TempEmail | null;
}

export const tempEmailsRepo = { create, findLatestByVisitingCardId };
