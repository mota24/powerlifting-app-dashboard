import { createHash } from 'node:crypto'

// Politique de mots de passe appliquée CÔTÉ SERVEUR (impossible à contourner
// en modifiant le JavaScript de la page) :
//  1. règles de robustesse (longueur + complexité) ;
//  2. refus des mots de passe déjà apparus dans des fuites de données,
//     via l'API k-anonymat de Have I Been Pwned : seuls les 5 premiers
//     caractères hexadécimaux du hash SHA-1 sont envoyés — jamais le mot
//     de passe, ni même son hash complet.

export const PASSWORD_RULES_HINT =
  '12 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.'

/** Renvoie la liste des règles non respectées (vide = mot de passe conforme). */
export function validatePasswordStrength(password: string): string[] {
  const manques: string[] = []
  if (password.length < 12) manques.push('au moins 12 caractères')
  if (password.length > 72) manques.push('au maximum 72 caractères')
  if (!/[a-z]/.test(password)) manques.push('au moins une minuscule')
  if (!/[A-Z]/.test(password)) manques.push('au moins une majuscule')
  if (!/[0-9]/.test(password)) manques.push('au moins un chiffre')
  return manques
}

/**
 * Nombre d'apparitions du mot de passe dans les fuites connues de HIBP.
 * 0 = jamais vu ; null = service injoignable (l'appelant choisit sa tolérance).
 */
export async function pwnedCount(password: string): Promise<number | null> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      // Le padding ajoute de fausses lignes (compteur 0) : même la taille de
      // la réponse ne révèle rien sur le préfixe interrogé.
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [candidate, count] = line.trim().split(':')
      if (candidate === suffix) {
        const n = Number.parseInt(count ?? '0', 10)
        return Number.isFinite(n) ? n : 0
      }
    }
    return 0
  } catch {
    return null
  }
}
