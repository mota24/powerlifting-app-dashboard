/** Fuseau de l'app : une journée de pas commence et finit à minuit, heure de Paris. */
const FUSEAU = 'Europe/Paris'

/** 'YYYY-MM-DD' au fuseau de l'app ('en-CA' produit ce format nativement). */
const jourParis = (instant: Date) => instant.toLocaleDateString('en-CA', { timeZone: FUSEAU })

/**
 * Jour auquel ranger les pas reçus. Par défaut aujourd'hui ; « hier » sert au
 * rattrapage du matin, quand l'envoi de la veille au soir n'a pas pu partir.
 * Rien d'autre n'est accepté : on ne réécrit pas l'historique à distance.
 */
export function jourDesPas(jour: string | null, maintenant: Date = new Date()): string | null {
  if (jour === null || jour === '' || jour === 'aujourdhui') return jourParis(maintenant)
  if (jour === 'hier') {
    // Midi d'aujourd'hui moins 24 h : toujours la veille, même le jour d'un changement d'heure.
    const aujourdhui = jourParis(maintenant)
    const [a, m, j] = aujourdhui.split('-').map(Number)
    return jourParis(new Date(Date.UTC(a, m - 1, j, 12) - 86_400_000))
  }
  return null
}

/**
 * Les pas d'une journée ne font que monter. Un envoi plus bas que ce qui est
 * déjà enregistré vient d'une lecture incomplète — iPhone verrouillé, Santé
 * pas encore à jour — et ne doit pas effacer le vrai total.
 * Renvoie la valeur à écrire, ou null s'il n'y a rien à changer.
 */
export function pasAEcrire(enregistres: number | null, recus: number): number | null {
  return enregistres !== null && enregistres >= recus ? null : recus
}
