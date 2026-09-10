import { toLocalDateStr, type SetData } from './powerlifting'

/** Colonnes de workout_sets nécessaires pour savoir si un jour était programmé. */
export interface LigneJour {
  date: string
  exercise_name: string | null
  tracking_data: SetData[] | null
  coach_tracking_data: SetData[] | null
}

const NOMS_REPOS = ['Repos', 'Jour de Repos']

const contientUneSerie = (series: SetData[] | null) =>
  Array.isArray(series) && series.some((s) => /[1-9]/.test(String(s?.reps ?? '')) || /[1-9]/.test(String(s?.weight ?? '')))

/**
 * Dates où une séance était programmée : une ligne hors repos portant une
 * prescription ou au moins une série notée. Même définition que la fonction
 * SQL du classement, pour que la série et les points restent cohérents.
 */
export function joursProgrammes(lignes: LigneJour[]): Set<string> {
  const jours = new Set<string>()
  for (const ligne of lignes) {
    if (NOMS_REPOS.includes(ligne.exercise_name ?? '')) continue
    if (contientUneSerie(ligne.coach_tracking_data) || contientUneSerie(ligne.tracking_data)) jours.add(ligne.date)
  }
  return jours
}

function lendemain(iso: string): string {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return toLocalDateStr(new Date(annee, mois - 1, jour + 1))
}

/**
 * Série après la validation du jour.
 *
 * Elle casse si un jour programmé, entre la dernière validation et aujourd'hui,
 * n'a pas été validé. Un jour sans séance programmée est un repos : il ne
 * casse rien. Comme la base n'accepte une validation que le jour même, chaque
 * jour de l'écart est forcément non validé.
 */
export function nouvelleSerie(
  serieActuelle: number,
  derniereValidation: string | null,
  aujourdhui: string,
  programmes: Set<string>
): number {
  if (!derniereValidation) return 1
  if (derniereValidation === aujourdhui) return serieActuelle
  // Date postérieure à aujourd'hui : état hérité de l'ancien calcul, qui
  // acceptait les validations d'autres jours. On repart de zéro.
  if (derniereValidation > aujourdhui) return 1
  for (let jour = lendemain(derniereValidation); jour < aujourdhui; jour = lendemain(jour)) {
    if (programmes.has(jour)) return 1
  }
  return serieActuelle + 1
}
