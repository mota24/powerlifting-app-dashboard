'use client'

/**
 * BANC D'ESSAI — monte l'app complète avec des données factices, sans base.
 *
 * Hors du dossier app/ : ce n'est donc PAS une page publiée. Pour s'en servir,
 * le copier le temps d'un audit :
 *   cp outils/banc-essai.tsx app/verif-audit/page.tsx   (puis le supprimer)
 *
 * Adresses utiles une fois lancé (npm run dev) :
 *   /verif-audit                  écran d'accueil, compte Moti (fr, powerlifting)
 *   /verif-audit?page=analytique  n'importe quelle vue : analytique, outils,
 *                                 calculatrice, configuration, palmares,
 *                                 classement, nutrition, photos
 *   /verif-audit?compte=yamina    deuxième compte (es, fitness)
 *   /verif-audit?echec=500        le serveur répond en erreur
 *   /verif-audit?echec=401        session refusée par la base
 *   /verif-audit?echec=401mort    session refusée partout : retour à la connexion
 *   /verif-audit?echec=reseau     coupure réseau
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'

const App = dynamic(() => import('@/app/page'), { ssr: false })

const AUJOURDHUI = new Date().toISOString().slice(0, 10)
const HIER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

const serie = (reps: string, weight: string, rpe = '') => ({ reps, weight, rpe })

const DONNEES: Record<string, unknown> = {
  profiles: [{ id: 'u1', theme: 'dark', mode: 'powerlifting', prenom: 'Moti', langue: 'fr' }],
  user_progress: [{ id: 'p1', level: 7, current_xp: 120, total_xp: 4200, streak_days: 5, last_completed_date: HIER, user_id: 'moti' }],
  workout_sets: [
    { id: 'w1', date: AUJOURDHUI, exercise_name: 'Back Squat', coach_tracking_data: [serie('5', '100'), serie('5', '100')], tracking_data: [serie('5', '100'), serie('5', '102.5')], comments: 'tempo 3-1-0', fatigue_score: 4, sleep_hours: 7, steps_count: 9000, order_index: 0, pain_level: 0 },
    { id: 'w2', date: AUJOURDHUI, exercise_name: 'Bench Press', coach_tracking_data: [serie('8', '70')], tracking_data: [serie('8', '70')], comments: null, fatigue_score: 4, sleep_hours: 7, steps_count: 9000, order_index: 1, pain_level: null },
    { id: 'w3', date: HIER, exercise_name: 'Deadlift', coach_tracking_data: [serie('3', '160')], tracking_data: [serie('3', '160')], comments: null, fatigue_score: 5, sleep_hours: 8, steps_count: 12000, order_index: 0, pain_level: 1 },
  ],
  training_blocks: [{ id: 'b1', block_number: 3, name: 'Force', start_date: '2026-09-01', duration_weeks: 6, user_id: 'moti' }],
  bodyweight_logs: [{ id: 'bw1', date: AUJOURDHUI, weight: 82.5, user_id: 'moti' }, { id: 'bw2', date: '2026-09-01', weight: 84, user_id: 'moti' }],
  competitions: [{
    id: 'c1', name: 'Open de Madrid', date: '2026-11-15', level: 'Régional', category: '83 kg', country_code: 'ES',
    bodyweight: 82.5, squat: 200, bench: 130, deadlift: 240, placement: 2,
    squat_1: 180, squat_2: 195, squat_3: 200, bench_1: 120, bench_2: 130, bench_3: 135,
    deadlift_1: 220, deadlift_2: 240, deadlift_3: 250, photo_urls: [], video_url: null, user_id: 'moti',
  }],
  records_perso: [{ squat: 205, bench: 135, deadlift: 245, modifie_le: AUJOURDHUI, user_id: 'moti' }],
  journal_alimentaire: [{ id: 'j1', date: AUJOURDHUI, nom: 'Skyr', marque: 'Lidl', code_barres: '123', grammes: 300, kcal_100g: 60, proteines_100g: 10, cree_le: AUJOURDHUI }],
  objectifs_nutrition: [{ kcal: 2400, proteines: 160, eau: 2500, user_id: 'moti' }],
  journal_eau: [{ date: AUJOURDHUI, ml: 1500, user_id: 'moti' }],
  modeles_seance: [{ id: 'm1', nom: 'Push', exercices: [{ name: 'Bench Press', coachTracking: [serie('5', '80')] }], user_id: 'moti' }],
  seances_pas: [{ date: AUJOURDHUI, pas: 9000, user_id: 'moti' }],
  photos_seance: [{ id: 'ph1', date: AUJOURDHUI, chemin: 'moti/a.jpg', chemin_mini: 'moti/a-mini.jpg', largeur: 800, hauteur: 600, octets: 12000, cree_le: AUJOURDHUI }],
  validations_seance: [{ date: HIER, type: 'seance', user_id: 'moti' }],
  aliments_perso: [{ code_barres: '123', nom: 'Skyr', marque: 'Lidl', kcal_100g: 60, proteines_100g: 10, portion_g: 150 }],
}

const RPC: Record<string, unknown> = {
  classement_mois: ['Moti', 'Yamina'].map((prenom, i) => ({
    mois: AUJOURDHUI.slice(0, 8) + '01', depuis: AUJOURDHUI.slice(0, 8) + '01', prenom, est_moi: i === 0,
    points: 120 - i * 40, pts_pas: 20, pts_eau: 20, pts_seances: 40, pts_repos: 10, pts_objectif: 30 - i * 30, pts_serie: 15,
    jours_8000: 2, jours_eau: 2, seances: 2, jours_repos: 1, objectif_fait: 1 - i, objectif_semaines: 2,
    objectif_atteint: i === 0, serie: 3, niveau: 7, streak: 5,
  })),
  classement_semaines: ['Moti', 'Yamina'].map((prenom, i) => ({
    semaine: AUJOURDHUI, prenom, est_moi: i === 0, points: 60 - i * 20, pts_pas: 10, pts_eau: 10, pts_seances: 20,
    pts_repos: 10, pts_objectif: 0, pts_serie: 10, jours_8000: 1, jours_eau: 1, seances: 1, jours_repos: 1,
    objectif_fait: 1, objectif_seances: 3, objectif_atteint: false, serie: 2, niveau: 7, streak: 5,
  })),
}

function corpsPour(url: string, methode: string): unknown {
  if (url.includes('/api/auth/session')) {
    // ?echec=401mort : le serveur ne reconnaît plus personne, comme un
    // jeton de refresh révoqué. L'app doit renvoyer à la connexion.
    if (new URLSearchParams(window.location.search).get('echec') === '401mort') return 'deconnecte'
    return { user: { id: 'u1', email: 'moti@power.app' } }
  }
  // ?compte=yamina : deuxième compte, mode fitness et espagnol.
  if (url.includes('/rest/v1/profiles') && new URLSearchParams(window.location.search).get('compte') === 'yamina') {
    return [{ id: 'u1', theme: 'dark', mode: 'fitness', prenom: 'Yamina', langue: 'es' }]
  }
  if (url.includes('/api/photos/fichier')) return {}
  if (url.includes('/api/photos')) return { photos: [] }
  if (url.includes('/api/aliments')) return { produits: [] }
  if (url.includes('/api/coach')) return [{ name: 'Back Squat', comments: 'test', coachTracking: [serie('3', '180'), serie('3', '180'), serie('3', '180')] }]
  const rpc = url.match(/rpc\/([a-z_]+)/)
  if (rpc) return RPC[rpc[1]] ?? []
  const table = url.match(/\/api\/db\/rest\/v1\/([a-z_]+)/)
  if (!table) return null
  if (methode !== 'GET') return []
  let lignes = [...((DONNEES[table[1]] ?? []) as Record<string, unknown>[])]
  // PostgREST en miniature : sans les filtres, le tri et la limite, un
  // .single() recevrait plusieurs lignes et échouerait pour rien.
  const params = new URLSearchParams(url.split('?')[1] ?? '')
  for (const [cle, valeur] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(cle)) continue
    const [operateur, ...reste] = valeur.split('.')
    const attendue = reste.join('.')
    lignes = lignes.filter((ligne) => {
      const brute = ligne[cle]
      const texte = brute === null || brute === undefined ? '' : String(brute)
      switch (operateur) {
        case 'eq': return texte === attendue
        case 'neq': return texte !== attendue
        case 'gt': return texte > attendue
        case 'gte': return texte >= attendue
        case 'lt': return texte < attendue
        case 'lte': return texte <= attendue
        case 'in': return attendue.replace(/[()"]/g, '').split(',').includes(texte)
        case 'is': return attendue === 'null' ? brute === null || brute === undefined : true
        case 'not': return attendue.endsWith('null') ? brute !== null && brute !== undefined : true
        default: return true
      }
    })
  }
  const tri = params.get('order')
  if (tri) {
    const [champ, sens] = tri.split('.')
    lignes.sort((a, b) => String(a[champ] ?? '').localeCompare(String(b[champ] ?? '')) * (sens === 'desc' ? -1 : 1))
  }
  const limite = Number(params.get('limit'))
  return limite > 0 ? lignes.slice(0, limite) : lignes
}

export default function BancEssai() {
  const [pret, setPret] = useState(false)
  const [journal, setJournal] = useState<string[]>([])

  const demarrer = () => {
    const vrai = window.fetch.bind(window)
    const appels: string[] = []
    window.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url)
      const methode = (init?.method ?? 'GET').toUpperCase()
      const corps = corpsPour(url, methode)
      if (corps === null) return vrai(entree as RequestInfo, init)
      if (corps === 'deconnecte') return new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } })
      appels.push(`${methode} ${url.replace(window.location.origin, '')}`)
      // ?echec=401|500|reseau : simule une session expirée, une panne serveur
      // ou une coupure réseau sur les appels à la base.
      const echec = new URLSearchParams(window.location.search).get('echec')
      if (echec && url.includes('/api/db/')) {
        if (echec === 'reseau') throw new TypeError('Failed to fetch')
        const code = echec === '401mort' ? 401 : Number(echec)
        return new Response(JSON.stringify({ message: code === 401 ? 'Session expirée' : 'Erreur serveur' }), {
          status: code, headers: { 'Content-Type': 'application/json' },
        })
      }
      // supabase-js passe ses en-têtes dans un objet Headers : les lire à la main
      // rendrait .single() et .maybeSingle() faussement vides.
      const accepte = new Headers(init?.headers ?? {}).get('Accept') ?? ''
      const accepteUnObjet = accepte.includes('vnd.pgrst.object')
      const charge = accepteUnObjet && Array.isArray(corps) ? (corps[0] ?? null) : corps
      return new Response(JSON.stringify(charge), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof window.fetch
    // Exposé pour l'inspection depuis la console de vérification.
    ;(window as unknown as { __appels: string[] }).__appels = appels
    setJournal(appels)
    setPret(true)
  }

  if (!pret) {
    return (
      <div className="p-6">
        <button onClick={demarrer} className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm font-bold">Démarrer le banc d&apos;essai</button>
        <p className="mt-2 text-xs text-muted-foreground">{journal.length} appels</p>
      </div>
    )
  }
  return <App />
}
