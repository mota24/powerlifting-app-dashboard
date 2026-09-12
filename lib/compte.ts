/** Utilisateur connecté, tel que le renvoie /api/auth/session (jamais de jeton). */
export interface AuthUser {
  id: string
  email: string | null
}

/** Les records saisis à la main ne doivent pas rester visibles pour le compte suivant. */
export function purgerRecordsLocaux() {
  try {
    for (const cle of ['mota_real_prs', 'mota_real_prs_powerlifting', 'mota_real_prs_fitness']) window.localStorage.removeItem(cle)
  } catch { }
}
