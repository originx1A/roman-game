/**
 * Netlify sets CONTEXT for the build command, not for function invocations.
 * Write that value into the function bundle so a production deploy can still
 * be recognized when the runtime Context object has no deploy context.
 * Off Netlify this does nothing and leaves the committed empty constant.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CONTEXT_RE = /^[A-Za-z0-9-]{1,64}$/
const defaultFile = join(dirname(fileURLToPath(import.meta.url)), '../netlify/lib/bakedDeployContext.ts')

/** @param {NodeJS.ProcessEnv} env */
export function bakedContextValue(env = process.env) {
  if (env.NETLIFY !== 'true') return null
  const raw = (env.CONTEXT ?? '').trim()
  return CONTEXT_RE.test(raw) ? raw : ''
}

/** @param {string} context */
export function bakedModuleSource(context) {
  return [
    '/** Written by scripts/bake-deploy-context.mjs during a Netlify build. The committed file is empty so a checkout cannot send. */',
    `export const BAKED_DEPLOY_CONTEXT = ${JSON.stringify(context)}`,
    '',
  ].join('\n')
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} file
 */
export function bakeDeployContextFile(env = process.env, file = defaultFile) {
  const value = bakedContextValue(env)
  if (value === null) return { wrote: false, context: '' }
  writeFileSync(file, bakedModuleSource(value))
  return { wrote: true, context: value }
}

function isDirectRun() {
  const arg = process.argv[1]
  if (!arg) return false
  return import.meta.url === pathToFileURL(arg).href
}

if (isDirectRun()) {
  const result = bakeDeployContextFile()
  if (result.wrote) console.log(`baked deploy context: ${result.context || 'unset'}`)
}
