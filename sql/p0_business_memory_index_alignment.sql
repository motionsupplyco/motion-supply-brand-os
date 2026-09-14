-- Align the live Business Memory unique index with the API upsert conflict target.
-- PostgreSQL 15+ NULLS NOT DISTINCT preserves uniqueness for company-wide
-- memory where brand_id is NULL while keeping a normal three-column index.

drop index if exists public.business_memory_scope_key_idx;

create unique index if not exists business_memory_owner_brand_key_uidx
  on public.business_memory(owner_id, brand_id, memory_key) nulls not distinct;
