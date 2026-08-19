import { supabase } from "../client";

export type OtpPurpose = "login" | "channel_link" | "channel_onboarding";

export interface OtpCodeRow {
  id: string;
  purpose: OtpPurpose;
  target: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

async function create(input: {
  purpose: OtpPurpose;
  target: string;
  codeHash: string;
  expiresAt: string;
}): Promise<OtpCodeRow> {
  const { data, error } = await supabase
    .from("otp_codes")
    .insert({
      purpose: input.purpose,
      target: input.target,
      code_hash: input.codeHash,
      expires_at: input.expiresAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as OtpCodeRow;
}

/** Most recent, still-unconsumed code for this target+purpose — the one an
 * incoming verify attempt should be checked against. */
async function findLatestPending(target: string, purpose: OtpPurpose): Promise<OtpCodeRow | null> {
  const { data, error } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("target", target)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as OtpCodeRow | null;
}

/** For the Telegram channel-link deep-link code: unlike a WhatsApp OTP
 * (looked up by target = the phone number the user typed in), the
 * inbound /start <code> only has the code itself — nothing else to look
 * up by — so this searches by the code's hash directly. `target` holds
 * the requesting account's id for these rows, not a phone number. */
async function findByCodeHash(codeHash: string, purpose: OtpPurpose): Promise<OtpCodeRow | null> {
  const { data, error } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as OtpCodeRow | null;
}

/** Not a floor/ceiling RPC like the coin-balance ones — the caller already
 * has the row (from findLatestPending) and just wrote back attempts+1.
 * Low-stakes counter (rate-limiting OTP guesses), a lost increment under a
 * genuine race isn't worth an RPC round-trip the way money is. */
async function setAttempts(id: string, attempts: number): Promise<void> {
  const { error } = await supabase.from("otp_codes").update({ attempts }).eq("id", id);
  if (error) throw error;
}

async function markConsumed(id: string): Promise<void> {
  const { error } = await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export const otpCodesRepo = {
  create,
  findLatestPending,
  findByCodeHash,
  setAttempts,
  markConsumed,
};
