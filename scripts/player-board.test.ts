import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migration-010-player-board.sql', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/components/PhoneProposal.tsx', import.meta.url), 'utf8')

test('the board migration only adds a new table, a view, and a function', () => {
  assert.match(sql, /create table if not exists public\.player_board_row/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /for select to anon, authenticated/)
  assert.match(sql, /grant select \(name, score\) on public\.player_board_row to anon, authenticated/)
  assert.match(sql, /security_invoker = true/)
  assert.match(sql, /grant execute on function public\.save_my_board_score\(integer\) to authenticated/)
  assert.match(sql, /group by p\.id, p\.public_name/)
  assert.match(sql, /new_score > current/)
  assert.doesNotMatch(sql, /alter table public\.players/i)
  assert.doesNotMatch(sql, /alter table public\.scores/i)
  assert.doesNotMatch(sql, /alter table public\.profiles/i)
  assert.doesNotMatch(sql, /alter table public\.parent_links/i)
  assert.doesNotMatch(sql, /create or replace view public\.leaderboard/i)
  assert.doesNotMatch(sql, /email/i)
  assert.doesNotMatch(sql, /auth\.users/i)
})

test('signed-in games write one score, and the public read asks only for name, score, and place', () => {
  assert.match(cloud, /save_my_board_score/)
  assert.match(cloud, /from\('player_board'\)\.select\('name, score, place'\)/)
  assert.doesNotMatch(cloud.slice(cloud.indexOf('loadPlayerBoard')), /email/)
})

test('the full board opens on phone and desktop, and the desktop home stays the same', () => {
  assert.match(app, /screen === 'board' && device !== 'tablet'/)
  assert.match(app, /device === 'tablet' && screen === 'board'/)
  assert.match(app, /<LiveBoard/)
  assert.match(home, /onBoard/)
  assert.match(home, /🏆/)
  assert.match(home, />Leaderboard</)
  assert.doesNotMatch(app, /onTap=\{undo\}/)
  assert.doesNotMatch(app, />\s*Undo\s*</)
  const desktop = app.split("screen === 'home' && device !== 'phone'")[1]?.split("screen === 'how'")[0] ?? ''
  assert.equal(desktop.includes('onBoard'), false)
  assert.equal(desktop.includes('PhoneBoard'), false)
})
