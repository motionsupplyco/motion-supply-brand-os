-- P0: only recognized subscription lifecycle states may be stored.

do $$ begin
  alter table public.subscriptions
    add constraint subscriptions_status_check
    check (status in (
      'inactive',
      'trialing',
      'active',
      'past_due',
      'unpaid',
      'paused',
      'canceled',
      'incomplete',
      'incomplete_expired'
    ));
exception when duplicate_object then null; end $$;
