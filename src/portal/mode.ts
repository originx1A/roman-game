/** True only in the CrazyGames and Poki builds. Node tests and the default build are false. */
export function isPortalBuild(): boolean {
  return typeof __PORTAL_BUILD__ !== 'undefined' && __PORTAL_BUILD__
}
