-- NOT RUN. Removes the end-to-end test players (Mike, Mike02 = originx+scorestest / +scorestest2 /
-- +scorestest3@mail.grokbot.com) from Supabase Auth and, by cascade, from players and scores.
-- Check the preview first, then run the delete.

-- 1. Preview what will go
select u.id, u.email, p.public_name, (select count(*) from public.scores s where s.player_id = u.id) as scores
from auth.users u left join public.players p on p.id = u.id
where u.email in ('originx+scorestest@mail.grokbot.com', 'originx+scorestest2@mail.grokbot.com', 'originx+scorestest3@mail.grokbot.com');

-- 2. Delete (players.id -> auth.users on delete cascade; scores.player_id -> players on delete cascade)
delete from auth.users
where email in ('originx+scorestest@mail.grokbot.com', 'originx+scorestest2@mail.grokbot.com', 'originx+scorestest3@mail.grokbot.com');

-- 3. Should now be empty of test rows
select * from public.leaderboard;
