/** Utilisateur connecté, tel que le renvoie /api/auth/session (jamais de jeton). */
export interface AuthUser {
  id: string
  email: string | null
}

/**
 * État de la session. « indisponible » n'est PAS une déconnexion : c'est le
 * serveur injoignable (salle en sous-sol, coupure, limite de débit). Les
 * confondre ferait réafficher l'écran de connexion à quelqu'un qui a une
 * session valide, et lui ferait ressaisir son mot de passe pour rien.
 */
export type ResultatSession =
  | { statut: 'connecte'; user: AuthUser }
  | { statut: 'deconnecte' }
  | { statut: 'indisponible' }

export async function lireSession(): Promise<ResultatSession> {
  try {
    const res = await fetch('/api/auth/session')
    if (res.status === 401) return { statut: 'deconnecte' }
    if (!res.ok) return { statut: 'indisponible' }
    const { user } = (await res.json()) as { user: AuthUser | null }
    return user ? { statut: 'connecte', user } : { statut: 'deconnecte' }
  } catch {
    return { statut: 'indisponible' }
  }
}

/** Les records saisis à la main ne doivent pas rester visibles pour le compte suivant. */
export function purgerRecordsLocaux() {
  try {
    for (const cle of ['mota_real_prs', 'mota_real_prs_powerlifting', 'mota_real_prs_fitness']) window.localStorage.removeItem(cle)
  } catch { }
}
