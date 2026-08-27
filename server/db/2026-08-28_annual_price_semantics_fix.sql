-- Fixes a semantic bug in plans.annual_price_inr: the name (and every
-- consumer of it) treated it as "the total amount charged once for the
-- whole year," but it was actually being entered by the admin as a
-- discounted MONTHLY rate under annual billing (e.g. plan_starter's
-- price_inr=999/mo, annual_price_inr=799 — a sensible ~20% annual
-- discount on the monthly rate, not "₹799 for an entire year," which
-- would be less than one month's price). The column is renamed to make
-- that meaning explicit, and the actual one-time charge for a year is
-- now computed in code as this value × 12 (see server/src/routes/api/
-- billing.route.ts) rather than charged directly.
--
-- No data transformation needed — the admin-entered values already are
-- the intended monthly-equivalent rates; only the rename + downstream
-- code that misread them changes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'plans' and column_name = 'annual_price_inr'
  ) then
    alter table public.plans rename column annual_price_inr to annual_monthly_price_inr;
  end if;
end $$;

comment on column public.plans.annual_monthly_price_inr is
  'Discounted per-month rate when this plan is billed annually. The actual one-time charge for a year is this value × 12, computed in code — not stored as a separate total. Null disables the annual billing option for this plan.';
