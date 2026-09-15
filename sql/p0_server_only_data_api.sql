-- P0: Brand OS cloud data is accessed through the Express API, not directly from the browser.
-- Remove unnecessary Data API table privileges from anon/authenticated roles.
-- RLS remains enabled as defense in depth; service_role remains the server data plane.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.brands from anon, authenticated;
revoke all on table public.skus from anon, authenticated;
revoke all on table public.scenarios from anon, authenticated;
revoke all on table public.import_summaries from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.product_events from anon, authenticated;
revoke all on table public.business_snapshots from anon, authenticated;
revoke all on table public.recommendation_history from anon, authenticated;
revoke all on table public.business_memory from anon, authenticated;
revoke all on table public.account_deletion_requests from anon, authenticated;
revoke all on table public.stripe_webhook_events from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
