-- P0: atomically claim Stripe webhook events before processing.
-- Concurrent duplicates are blocked, failed events may retry, and a worker that dies
-- mid-event can be reclaimed after a bounded stale-processing window.

alter table public.stripe_webhook_events
  add column if not exists status text not null default 'processing',
  add column if not exists failure_reason text,
  add column if not exists attempts integer not null default 1,
  add column if not exists claimed_at timestamptz not null default now();

alter table public.stripe_webhook_events
  alter column processed_at drop default,
  alter column processed_at drop not null;

do $$ begin
  alter table public.stripe_webhook_events
    add constraint stripe_webhook_events_status_check
    check (status in ('processing','completed','failed'));
exception when duplicate_object then null; end $$;

-- Rows written by the older handler were only inserted after successful processing.
update public.stripe_webhook_events
set status = 'completed'
where status = 'processing' and processed_at is not null;

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
