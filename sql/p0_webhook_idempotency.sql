-- P0: atomically claim Stripe webhook events before processing.
-- This prevents concurrent duplicate deliveries from both applying billing state.

alter table public.stripe_webhook_events
  add column if not exists status text not null default 'processing',
  add column if not exists failure_reason text,
  add column if not exists attempts integer not null default 1;

alter table public.stripe_webhook_events
  alter column processed_at drop default;

do $$ begin
  alter table public.stripe_webhook_events
    add constraint stripe_webhook_events_status_check
    check (status in ('processing','completed','failed'));
exception when duplicate_object then null; end $$;

-- Rows written by the older handler were only inserted after successful processing.
update public.stripe_webhook_events
set status = 'completed'
where status = 'processing' and processed_at is not null;
