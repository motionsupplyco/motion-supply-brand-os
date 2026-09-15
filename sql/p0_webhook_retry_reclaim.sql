-- P0: allow Stripe to retry transient webhook failures without losing idempotency.
-- Completed events remain permanently claimed. Failed events may retry immediately.
-- Processing rows may be reclaimed after 15 minutes in case a worker died mid-event.

alter table public.stripe_webhook_events
  add column if not exists claimed_at timestamptz not null default now();

create or replace function public.claim_stripe_webhook_event(p_event_id text,p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_webhook_events(event_id,event_type,status,attempts,processed_at,failure_reason,claimed_at)
  values(p_event_id,p_event_type,'processing',1,null,null,now())
  on conflict (event_id) do update
    set event_type = excluded.event_type,
        status = 'processing',
        attempts = public.stripe_webhook_events.attempts + 1,
        processed_at = null,
        failure_reason = null,
        claimed_at = now()
  where public.stripe_webhook_events.status = 'failed'
     or (
       public.stripe_webhook_events.status = 'processing'
       and public.stripe_webhook_events.claimed_at < now() - interval '15 minutes'
     );
  return found;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text,text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text,text) to service_role;
