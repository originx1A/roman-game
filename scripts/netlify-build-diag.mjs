/**
 * Temporary: publish a redacted build log so a private Netlify preview
 * failure can be read from /build-diag.txt. Exits 0 so the file is uploaded
 * even when the real build command fails.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const lines = []
const note = (line) => lines.push(String(line))

note(`node ${process.version}`)
note(`NODE_ENV=${process.env.NODE_ENV ?? '<unset>'}`)
note(`CONTEXT=${process.env.CONTEXT ?? '<unset>'}`)
note(`NPM_CONFIG_PRODUCTION=${process.env.NPM_CONFIG_PRODUCTION ?? '<unset>'}`)
note(`npm_config_production=${process.env.npm_config_production ?? '<unset>'}`)
note(`NPM_FLAGS=${process.env.NPM_FLAGS ?? '<unset>'}`)
note(`CI=${process.env.CI ?? '<unset>'}`)
note(`hasSupabase=${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'yes' : 'no'}`)
note(`hasStripe=${process.env.STRIPE_SECRET_KEY ? 'yes' : 'no'}`)
note(`hasWebhook=${process.env.STRIPE_WEBHOOK_SECRET ? 'yes' : 'no'}`)
note(`hasResend=${process.env.RESEND_API_KEY ? 'yes' : 'no'}`)

function run(command, args) {
  note(`$ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { encoding: 'utf8', env: process.env, maxBuffer: 20_000_000 })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  note(output.slice(-12000))
  note(`exit ${result.status}`)
  if (result.error) note(`spawn ${result.error.message}`)
  return result.status ?? 1
}

const installed = run('npm', ['ci', '--include=dev'])
const built = installed === 0 ? run('npm', ['run', 'build']) : 'skipped'
note(`ci ${installed} build ${built}`)

const redacted = lines.join('\n').replace(/(?:sk_|rk_|rkcs_|whsec_|eyJ|re_)[A-Za-z0-9._-]{6,}/g, '[redacted]')
mkdirSync('dist', { recursive: true })
writeFileSync('dist/build-diag.txt', redacted)
process.exit(0)
