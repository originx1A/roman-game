-- Migration 005 (leaderboard screen)
-- The game reads public.public_scores in the browser and builds Today, This week, and All-time there.
-- This only adds the daily puzzle's date to that public list, and hides practice runs.
-- No new table. No weekly view. No rows are changed or deleted.
-- Safe to run more than once. Run after migration 004 (scores.daily_date).

create or replace view public.public_scores as
  select p.public_name as name,
         s.score,
         s.level,
         s.moves,
         s.time_seconds,
         s.mode,
         s.created_at,
         s.daily_date
  from public.scores s
  join public.players p on p.id = s.player_id
  where not p.is_flagged
    and s.mode is distinct from 'practice';

revoke all on public.public_scores from public;
grant select on public.public_scores to anon, authenticated;
