/**
 * Règles du proxy /api/db : seuls des chemins PostgREST simples passent, et
 * seules les fonctions listées ici sont appelables. Le reste de Supabase
 * (auth, storage, fonctions non listées) reste hors d'atteinte du navigateur,
 * même par un chemin détourné (« .. », séparateur encodé).
 */

const SEGMENT = /^[A-Za-z0-9_]+$/

export const RPC_AUTORISEES: ReadonlySet<string> = new Set(['classement_semaines'])

/** 'rest/v1/<table>' ou 'rest/v1/rpc/<fonction autorisée>' ; null pour tout le reste. */
export function cheminProxyAutorise(segments: readonly string[]): string | null {
  const [rest, version, ressource, fonction, ...reste] = segments
  if (rest !== 'rest' || version !== 'v1' || !ressource || !SEGMENT.test(ressource)) return null
  if (ressource === 'rpc') {
    return fonction !== undefined && reste.length === 0 && RPC_AUTORISEES.has(fonction) ? `rest/v1/rpc/${fonction}` : null
  }
  return fonction === undefined ? `rest/v1/${ressource}` : null
}
