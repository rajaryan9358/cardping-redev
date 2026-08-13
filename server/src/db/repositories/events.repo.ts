import { supabase } from "../client";
import { EventRow } from "../../types/domain";

async function create(userId: string, name: string): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({ user_id: userId, name })
    .select("*")
    .single();

  if (error) throw error;
  return data as EventRow;
}

export const eventsRepo = { create };
