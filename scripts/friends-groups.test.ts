import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { boardError } from '../src/cloud/boardError.ts'

const sql = readFileSync(new URL('../supabase/migration-011-friends-groups.sql', import.meta.url), 'utf8')
const sql12 = readFileSync(new URL('../supabase/migration-012-founder-leave.sql', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('../src/components/PhoneBoard.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/cloud/friendsGroups.ts', import.meta.url), 'utf8')
const names = readFileSync(new URL('../src/cloud/groupNames.ts', import.meta.url), 'utf8')
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
    'Ask to join',
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

test('the full board, with friends and groups, opens on the desktop too', () => {
  assert.match(app, /screen === 'board' && device !== 'tablet'/)
  assert.match(app, /device === 'tablet' && screen === 'board'/)
  assert.match(app, /<LiveBoard/)
  assert.match(app, /onSeeAll=\{\(\) => setBoardOpen\(true\)\}/)
  assert.match(app, /className="board-pop"/)
  assert.match(app, /data-testid="go-home"/)
  assert.match(ui, /Sign in to add friends and join groups/)
  const desktop = app.split("screen === 'home' && device !== 'phone'")[1]?.split("screen === 'how'")[0] ?? ''
  assert.equal(desktop.includes('home-board'), false)
  assert.equal(desktop.includes('LiveBoard'), false)
  assert.equal(desktop.includes('onBoard'), false)
  assert.equal(desktop.includes('PhoneBoard'), false)
  const play = app.split("screen === 'play' && puzzle && (")[1]?.split("screen === 'remix'")[0] ?? ''
  assert.match(play, /<LiveBoard/)
  assert.match(app, /opts\.daily \|\| opts\.endless \|\| opts\.mode \|\| parseRemixId\(p\.id\)/)
  assert.doesNotMatch(app, /Mix it up/)
  assert.doesNotMatch(app, /no undos/)
  assert.doesNotMatch(app, /no undo</)
  assert.match(tag, /build 9\.33-g/)
})

test('migration 014 stores the one-time age confirmation and logout revokes the session', () => {
  const sql14 = readFileSync(new URL('../supabase/migration-014-account-flags.sql', import.meta.url), 'utf8')
  assert.match(sql14, /create table if not exists public\.account_flags/)
  assert.match(sql14, /age_confirmed_at timestamptz not null/)
  assert.match(sql14, /terms_confirmed_at timestamptz not null/)
  assert.match(sql14, /enable row level security/)
  assert.match(sql14, /user_id = auth\.uid\(\)/)
  assert.match(sql14, /grant select, insert, update on public\.account_flags to authenticated/)
  assert.doesNotMatch(sql14, /alter table public\.players/i)
  assert.doesNotMatch(sql14, /alter table public\.scores/i)
  assert.doesNotMatch(sql14, /alter table public\.group_points/i)
  assert.doesNotMatch(sql14, /delete from public\.group_points/i)
  assert.doesNotMatch(sql14, /email/i)
  assert.doesNotMatch(sql14, /auth\.users/i)
  assert.doesNotMatch(sql14, /service_role/i)
  assert.match(cloud, /signOut\(\{ scope: 'global' \}\)/)
  assert.match(cloud, /auth\.getUser\(\)/)
  assert.match(cloud, /window\.addEventListener\('focus'/)
  assert.match(cloud, /persistSession: true/)
  assert.match(cloud, /from\('account_flags'\)/)
  const scores = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
  const recover = scores.split("sheet === 'recover' &&")[1]?.split("sheet === 'sent'")[0] ?? ''
  assert.doesNotMatch(recover, /I'm 13 or older/)
  assert.match(recover, /We'll send a 6-digit code/)
  assert.match(recover, /Email me a code/)
  assert.doesNotMatch(recover, /no account/i)
  assert.doesNotMatch(recover, /account found/i)
  const sent = scores.split("sheet === 'sent' &&")[1]?.split("sheet === 'password'")[0] ?? ''
  assert.match(sent, /If we can use that email, we sent a 6-digit code/)
  assert.doesNotMatch(sent, /no account/i)
  assert.doesNotMatch(sent, /account found/i)
  assert.match(scores, /Player name or email/)
  assert.match(scores, /Can't get in\?/)
  assert.match(scores, /Use a picture password/)
  assert.match(scores, />\s*Log out\s*</)
  assert.match(scores, /s !== 'sent' && s !== 'password' && s !== 'picture' && s !== 'secret' && s !== 'name'/)
  assert.doesNotMatch(scores, /stripe|checkout|payment/i)
  const who = scores.split("sheet === 'who' &&")[1]?.split("sheet === 'age'")[0] ?? ''
  assert.match(who, /includes\('@'\)/)
  assert.match(who, /lookupAccount\(/)
  assert.ok(who.indexOf("includes('@')") < who.indexOf('lookupAccount('))
  assert.match(who, /found === 'existing'/)
  assert.match(who, /setSheet\('password'\)/)
  assert.match(who, /found === 'new'/)
  assert.match(who, /setSheet\('age'\)/)
  assert.match(who, /Try again in a little while\./)
  const passwordForm = scores.split("sheet === 'password' &&")[1]?.split("sheet === 'picture'")[0] ?? ''
  assert.match(passwordForm, /aria-label="Password"/)
  assert.match(passwordForm, /signInWithName\(passwordName, password, token\)/)
  assert.doesNotMatch(passwordForm, /I'm 13 or older/)
  assert.doesNotMatch(passwordForm, /type="checkbox"/)
  const lookup = cloud.slice(cloud.indexOf('function lookupAccount'), cloud.indexOf('function sendRecoveryCode'))
  assert.match(lookup, /\/api\/auth\/account/)
  assert.doesNotMatch(lookup, /email/i)
  assert.match(lookup, /status === 429/)
  assert.match(cloud, /shouldCreateUser: false/)
  assert.match(cloud, /\/api\/auth\/signin/)
  assert.match(cloud, /stay_signed_in: true/)
  assert.match(cloud, /export async function persistServerSession/)
})

test('migration 012 adds ranks and listed names without touching old tables', () => {
  for (const table of ['group_roles', 'group_titles', 'group_closed', 'group_adjectives', 'group_nouns']) {
    assert.match(sql12, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(sql12, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(sql12, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`))
  }
  assert.match(sql12, /drop function if exists public\.create_group\(text\)/)
  assert.match(sql12, /create function public\.create_group\(adjective text, noun text\)/)
  assert.match(sql12, /rename_group\(adjective text, noun text\)/)
  assert.match(sql12, /Pick a name from the list/)
  assert.match(sql12, /'Golden'/)
  assert.match(sql12, /'Owls'/)
  assert.match(sql12, /rg_next_leader/)
  assert.match(sql12, /Two Captains already/)
  assert.match(sql12, /group_closed/)
  assert.match(sql12, /where not exists \(select 1 from public\.group_closed c where c\.group_id = g\.id\)/)
  assert.match(sql12, /grant execute on function public\.group_period_rows\(text\) to anon, authenticated/)
  assert.match(sql12, /grant select \(group_name, average, place, active_members, season_points\) on public\.group_week_board/)
  assert.match(sql12, /grant select \(group_name, average, place, active_members, season_points\) on public\.group_month_board/)
  assert.match(sql12, /No member names or ids/)
  const roster = sql12.slice(sql12.indexOf('function public.group_member_rows'), sql12.indexOf('function public.request_inbox'))
  assert.match(roster, /m\.player_id = uid and m\.left_at is null/)
  assert.match(roster, /if uid is null then/)
  assert.doesNotMatch(sql12, /alter table public\.players/i)
  assert.doesNotMatch(sql12, /alter table public\.scores/i)
  assert.doesNotMatch(sql12, /alter table public\.profiles/i)
  assert.doesNotMatch(sql12, /alter table public\.parent_links/i)
  assert.doesNotMatch(sql12, /alter table public\.player_board_row/i)
  assert.doesNotMatch(sql12, /alter table public\.game_groups/i)
  assert.doesNotMatch(sql12, /alter table public\.group_members/i)
  assert.doesNotMatch(sql12, /alter table public\.group_points/i)
  assert.doesNotMatch(sql12, /delete from public\.group_points/i)
  assert.doesNotMatch(sql12, /email/i)
  assert.doesNotMatch(sql12, /auth\.users/i)
  assert.doesNotMatch(sql12, /service_role/i)
  const sql13 = readFileSync(new URL('../supabase/migration-013-group-size.sql', import.meta.url), 'utf8')
  assert.match(sql13, /That group is full/)
  assert.match(sql13, /n >= 10/)
  assert.doesNotMatch(sql13, /delete from public\.group_points/i)
  const remove = sql12.slice(sql12.indexOf('function public.remove_inactive_member'), sql12.indexOf('function public.promote_captain'))
  assert.doesNotMatch(remove, /founder_id/)
  for (const word of ['Golden', 'Brave', 'Swift', 'Loyal', 'Silver', 'Hidden', 'Owls', 'Lions', 'Knights', 'Keepers', 'Stars', 'Foxes']) {
    assert.ok(names.includes(`'${word}'`), word)
    assert.ok(sql12.includes(`'${word}'`), word)
  }
})

test('a group name is two listed words, with no free-text field', () => {
  for (const label of ['+ Create a group', 'My group', 'Rename', 'Leader', 'Captain', 'Next in line', 'Promote', 'Demote', 'becomes Leader', 'group will close']) {
    assert.ok(ui.includes(label), label)
  }
  assert.match(ui, /data-testid="create-group"/)
  assert.match(ui, /data-testid="group-adjective"/)
  assert.match(ui, /data-testid="group-noun"/)
  assert.match(ui, /data-testid="leave-confirm"/)
  assert.match(ui, /if \(!mine\) return/)
  assert.match(ui, /mine && members\.length > 0/)
  assert.match(sql12, /when uid is not null and exists/)
  assert.doesNotMatch(ui, /<input/)
  assert.doesNotMatch(ui, /name-input/)
  assert.doesNotMatch(ui, /isProfane/)
  assert.match(api, /rpc\('create_group', \{ adjective, noun \}\)/)
  assert.match(api, /rpc\('rename_group', \{ adjective, noun \}\)/)
  assert.doesNotMatch(api, /create_group', \{ group_name/)
})

test('board errors stay short and never pass an address through', () => {
  assert.equal(boardError({ message: 'Leave your group first' }), 'Leave your group first')
  assert.equal(boardError({ message: 'ERROR: That member is still active' }), 'That member is still active')
  assert.equal(boardError({ message: 'Could not find the function public.create_group in the schema cache' }), "The board isn't up yet.")
  assert.equal(boardError({ message: 'permission denied for table friend_links' }), "The board isn't up yet.")
  assert.equal(boardError(null), "The board isn't up yet.")
})
