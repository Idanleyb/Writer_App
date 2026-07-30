-- Run this in Supabase SQL Editor (New query) in your existing project —
-- this is additive, safe to run even though schema.sql already ran once.

alter table articles
  add column if not exists search_log jsonb not null default '[]'::jsonb;

comment on column articles.search_log is
  'Array of {query, results:[{title,url}]} — the actual web searches the model ran and what it found, shown to the user for transparency and debugging.';
