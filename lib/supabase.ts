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

export const supabase = createClient(proxyUrl, supabaseAnonKey, {
  auth: {
    // Aucune session côté client : l'authentification vit dans les cookies
    // httpOnly gérés par /api/auth/* — rien n'est écrit dans le localStorage.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
