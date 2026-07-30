// Limiteur de débit en mémoire, par instance de fonction — zéro
// dépendance externe, aucun appel réseau, coût quasi nul (une poignée
// de comparaisons de timestamps).
//
// ⚠️ Limite honnête : sur Vercel (serverless), chaque instance de
// fonction a SA PROPRE mémoire, non partagée avec les autres. Si le
// trafic est réparti sur plusieurs instances (pic de charge, cold
// starts), le compteur réel est "par instance", pas global — un
// attaquant distribué pourrait dépasser la limite affichée. Ce n'est
// donc PAS un rempart anti-brute-force de précision (ce rôle reste à
// la couche partagée Supabase de lib/server/rate-limit.ts, réservée
// au login). Ici, l'objectif est différent et plus modeste : écrêter
// un pic de trafic agressif venant d'une même instance chaude — un
// scraping en boucle serrée, un bug client qui spam la même route —
// avant qu'il ne consomme le quota d'invocations Vercel Hobby. Utile
// en best-effort, pas parfait : je préfère te le dire plutôt que de
// le vendre comme une garantie.

interface Fenetre {
  horodatages: number[]
}

const fenetres = new Map<string, Fenetre>()
let dernierePurge = Date.now()
const INTERVALLE_PURGE_MS = 5 * 60_000
const AGE_MAX_PURGE_MS = 5 * 60_000

/** Retire les clés dont tous les horodatages sont trop vieux pour compter encore, où que soit la fenêtre appelante. */
function purgerSiNecessaire(maintenant: number) {
  if (maintenant - dernierePurge < INTERVALLE_PURGE_MS) return
  dernierePurge = maintenant
  for (const [cle, f] of fenetres) {
    if (f.horodatages.every((t) => maintenant - t > AGE_MAX_PURGE_MS)) fenetres.delete(cle)
  }
}

export interface VerdictMemoire {
  bloque: boolean
  retryAfterSeconds: number
}

/**
 * Fenêtre glissante : autorise au plus `limite` requêtes par `fenetreMs`
 * pour une `cle` donnée (typiquement une IP). Compte la requête courante
 * dans le total seulement si elle est autorisée — une requête bloquée
 * n'est pas comptée deux fois.
 */
export function limiterMemoire(cle: string, limite: number, fenetreMs: number): VerdictMemoire {
  const maintenant = Date.now()
  purgerSiNecessaire(maintenant)

  const f = fenetres.get(cle) ?? { horodatages: [] }
  const recents = f.horodatages.filter((t) => maintenant - t < fenetreMs)

  if (recents.length >= limite) {
    fenetres.set(cle, { horodatages: recents })
    const plusAncien = recents[0]
    return { bloque: true, retryAfterSeconds: Math.max(1, Math.ceil((plusAncien + fenetreMs - maintenant) / 1000)) }
  }

  recents.push(maintenant)
  fenetres.set(cle, { horodatages: recents })
  return { bloque: false, retryAfterSeconds: 0 }
}
