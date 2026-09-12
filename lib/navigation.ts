export const VUES = ['accueil', 'analytique', 'outils', 'calculatrice', 'configuration', 'palmares', 'classement', 'nutrition', 'photos'] as const
export type Vue = (typeof VUES)[number]

/** Page inconnue dans l'URL (vieux lien, adresse modifiée) : retour à l'accueil plutôt qu'un écran vide. */
export function vueDepuisUrl(): Vue {
  if (typeof window === 'undefined') return 'accueil'
  const page = new URLSearchParams(window.location.search).get('page')
  return VUES.find((v) => v === page) ?? 'accueil'
}
