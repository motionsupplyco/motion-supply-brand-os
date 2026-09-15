-- P0 privacy/account deletion consistency.
-- Anonymous-only product events may remain anonymous, but events associated with a signed-in
-- account are deleted when that Auth user is deleted.

alter table public.product_events
  drop constraint if exists product_events_user_id_fkey;

alter table public.product_events
  add constraint product_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
