-- P0 follow-up: covering indexes for composite foreign keys flagged by Supabase advisors.
create index if not exists business_memory_brand_owner_fk_idx on public.business_memory(brand_id, owner_id);
create index if not exists business_snapshots_brand_owner_fk_idx on public.business_snapshots(brand_id, owner_id);
create index if not exists recommendation_history_brand_owner_fk_idx on public.recommendation_history(brand_id, owner_id);
