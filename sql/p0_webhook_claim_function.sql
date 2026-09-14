-- Server-only atomic claim for Stripe webhook event IDs.
create or replace function public.claim_stripe_webhook_event(p_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_webhook_events(event_id,event_type,status,attempts,processed_at,failure_reason)
  values(p_event_id,p_event_type,'processing',1,null,null)
  on conflict (event_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text,text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text,text) to service_role;
