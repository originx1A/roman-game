import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { boardError } from '../src/cloud/boardError.ts'

const sql = readFileSync(new URL('../supabase/migration-011-friends-groups.sql', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('../src/components/PhoneBoard.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/cloud/friendsGroups.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const tag = readFileSync(new URL('../src/buildTag.ts', import.meta.url), 'utf8')

test('migration 011 only adds new objects, with RLS, and never an email', () => {
  for (const table of ['game_groups', 'group_members', 'group_join_requests', 'friend_links', 'group_points', 'group_roster_lock']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`))
  }
  assert.match(sql, /security_invoker = false/)
  assert.match(sql, /grant select on public\.everyone_board to anon, authenticated/)
  assert.match(sql, /grant select on public\.group_week_board to anon, authenticated/)
  assert.match(sql, /grant select on public\.group_month_board to anon, authenticated/)
  assert.match(sql, /grant execute on function public\.send_friend_request\(text\) to authenticated/)
  assert.match(sql, /grant execute on function public\.request_join\(text\) to authenticated/)
  assert.match(sql, /revoke all on function public\.send_friend_request\(text\) from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant execute on function public\.create_group\(text\) to anon/)
  assert.doesNotMatch(sql, /alter table public\.players/i)
  assert.doesNotMatch(sql, /alter table public\.scores/i)
  assert.doesNotMatch(sql, /alter table public\.profiles/i)
  assert.doesNotMatch(sql, /alter table public\.parent_links/i)
  assert.doesNotMatch(sql, /alter table public\.player_board_row/i)
  assert.doesNotMatch(sql, /create or replace view public\.leaderboard/i)
  assert.doesNotMatch(sql, /create or replace view public\.player_board\b/i)
  assert.doesNotMatch(sql, /email/i)
  assert.doesNotMatch(sql, /auth\.users/i)
  assert.doesNotMatch(sql, /service_role/i)
  assert.doesNotMatch(sql, /delete from public\.group_points/i)
})

test('personal best stays put, and each game adds points that stay with the group', () => {
  assert.match(sql, /from public\.player_board_row r/)
  assert.match(sql, /insert into public\.group_points/)
  assert.match(sql, /rg_games_between\(m\.player_id, b\.start_on, b\.end_on\) >= 3/)
  assert.match(sql, /ac\.active_count >= 3/)
  assert.match(sql, /interval '30 days'/)
  assert.match(sql, /America\/Toronto/)
  assert.match(sql, /make_date\(yr, 12, 1\)/)
  assert.match(sql, /member_names/)
  assert.match(sql, /on conflict \(group_id, season_year\) do nothing/)
  assert.match(sql, /set left_at = now\(\)/)
  assert.match(sql, /That member is still active/)
  const leave = sql.slice(sql.indexOf('function public.leave_group'), sql.indexOf('function public.remove_inactive_member'))
  assert.doesNotMatch(leave, /group_points/)
  assert.match(cloud, /save_my_board_score/)
  assert.match(cloud, /for \(const row of rows\) \{\s*await sb\.rpc\('record_my_group_points'/)
})

test('the phone board has the three tabs, the sheets, and no chat or recruiting board', () => {
  for (const label of [
    'Everyone',
    'Friends',
    'Groups',
    'Week',
    'Month',
    'Add friend',
    'Request to join',
    'Cancel request',
    'Accept',
    'Decline',
    'Unfriend',
    'Leave group',
    'Remove',
    'Create group',
    'Requests',
    'Active',
    'Inactive',
    'Season',
    'Sign in to get on the board',
  ]) {
    assert.ok(ui.includes(label), label)
  }
  assert.match(ui, /data-testid="board-row"/)
  assert.match(ui, /group-tag/)
  assert.doesNotMatch(ui, /chat/i)
  assert.doesNotMatch(ui, /recruit/i)
  assert.doesNotMatch(ui, /email/i)
  assert.doesNotMatch(api, /email/i)
  assert.match(api, /from\('everyone_board'\)\.select\('name, score, place, group_name'\)/)
  assert.match(api, /from\('player_board'\)\.select\('name, score, place'\)/)
})

test('desktop home still has no leaderboard', () => {
  assert.match(app, /screen === 'board' && device === 'phone'/)
  assert.match(app, /device !== 'phone' && screen === 'board'/)
  const desktop = app.split("screen === 'home' && device !== 'phone'")[1]?.split("screen === 'how'")[0] ?? ''
  assert.equal(desktop.includes('onBoard'), false)
  assert.equal(desktop.includes('PhoneBoard'), false)
  assert.match(tag, /build 9\.33-a/)
})

test('board errors stay short and never pass an address through', () => {
  assert.equal(boardError({ message: 'Leave your group first' }), 'Leave your group first')
  assert.equal(boardError({ message: 'ERROR: That member is still active' }), 'That member is still active')
  assert.equal(boardError({ message: 'Could not find the function public.create_group in the schema cache' }), "The board isn't up yet.")
  assert.equal(boardError({ message: 'permission denied for table friend_links' }), "The board isn't up yet.")
  assert.equal(boardError(null), "The board isn't up yet.")
})
