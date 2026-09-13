import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Le navigateur ne détient plus AUCUN jeton d'authentification : toutes les
// requêtes passent par le proxy same-origin /api/db, qui attache le jeton
// depuis un cookie httpOnly (illisible par le JavaScript de la page).
// L'URL de repli côté serveur n'est jamais requêtée (les requêtes partent
// toutes de useEffect, donc du navigateur).
const proxyUrl =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/db`
    : 'http://localhost/api/db'

/**
 * Le proxy renvoie 401 quand la session est morte (jeton expiré et refresh
 * refusé). Sans signal, chaque écran afficherait simplement « aucune donnée » :
 * l'utilisateur croit ses données perdues. On préviens l'app, qui revérifie la
 * session et renvoie à la connexion si elle est bien terminée.
 */
export const EVENEMENT_SESSION_PERDUE = 'session-perdue'

const fetchAvecDetectionSession: typeof fetch = async (entree, init) => {
  const reponse = await fetch(entree, init)
  if (reponse.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENEMENT_SESSION_PERDUE))
  }
  return reponse
}

export const supabase = createClient(proxyUrl, supabaseAnonKey, {
  global: { fetch: fetchAvecDetectionSession },
  auth: {
    // Aucune session côté client : l'authentification vit dans les cookies
    // httpOnly gérés par /api/auth/* — rien n'est écrit dans le localStorage.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
