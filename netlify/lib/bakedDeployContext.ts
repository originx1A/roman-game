/**
 * Netlify deploy context captured at site build time.
 * scripts/bake-deploy-context.mjs overwrites this on Netlify, where CONTEXT
 * exists. The committed value stays empty so a checkout, CI, and local dev
 * cannot look like production.
 */
export const BAKED_DEPLOY_CONTEXT = ''
