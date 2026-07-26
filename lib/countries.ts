// Pays des compétitions.
//
// On stocke le code ISO 3166-1 alpha-2 ('ES', 'FR') et non l'émoji : deux
// caractères en base, comparables et triables, à partir desquels le drapeau
// se dérive. L'inverse serait impossible à exploiter autrement qu'à l'écran.

/**
 * Code ISO alpha-2 → émoji drapeau, via les indicateurs régionaux Unicode
 * ('ES' → U+1F1EA U+1F1F8 → 🇪🇸). Renvoie une chaîne vide si le code est
 * absent ou mal formé, pour ne jamais afficher de caractère parasite.
 */
export function countryCodeToFlag(code: string | null | undefined): string {
  if (!code) return ''
  const normalise = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalise)) return ''
  return String.fromCodePoint(...[...normalise].map((lettre) => 0x1f1e6 + lettre.charCodeAt(0) - 65))
}

/** Nom du pays — pour l'accessibilité et la saisie, jamais affiché sur les cartes. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  const normalise = code.trim().toUpperCase()
  return COUNTRIES.find((pays) => pays.code === normalise)?.name ?? null
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'AR', name: 'Argentine' },
  { code: 'AU', name: 'Australie' },
  { code: 'AT', name: 'Autriche' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BR', name: 'Brésil' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chili' },
  { code: 'CN', name: 'Chine' },
  { code: 'CO', name: 'Colombie' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'HR', name: 'Croatie' },
  { code: 'DK', name: 'Danemark' },
  { code: 'EG', name: 'Égypte' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'ES', name: 'Espagne' },
  { code: 'EE', name: 'Estonie' },
  { code: 'US', name: 'États-Unis' },
  { code: 'FI', name: 'Finlande' },
  { code: 'FR', name: 'France' },
  { code: 'GR', name: 'Grèce' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IN', name: 'Inde' },
  { code: 'IE', name: 'Irlande' },
  { code: 'IS', name: 'Islande' },
  { code: 'IL', name: 'Israël' },
  { code: 'IT', name: 'Italie' },
  { code: 'JP', name: 'Japon' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MA', name: 'Maroc' },
  { code: 'MX', name: 'Mexique' },
  { code: 'NO', name: 'Norvège' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'République tchèque' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'RS', name: 'Serbie' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SE', name: 'Suède' },
  { code: 'CH', name: 'Suisse' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'TR', name: 'Turquie' },
  { code: 'UA', name: 'Ukraine' },
]
