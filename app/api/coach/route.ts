import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type AiSet = { reps: string; weight: string; rpe: string }
type AiExercise = { name: string; comments: string; coachTracking: AiSet[] }

/** Nettoie et valide la réponse brute de l'IA — on ne fait jamais confiance au JSON généré */
function sanitizeAiResponse(raw: unknown): AiExercise[] {
  if (!Array.isArray(raw)) throw new Error('Réponse IA invalide (tableau attendu)')
  return raw.slice(0, 15).map((item) => {
    const ex = (item ?? {}) as Record<string, unknown>
    const tracking = Array.isArray(ex.coachTracking) ? ex.coachTracking : []
    return {
      name: typeof ex.name === 'string' ? ex.name.slice(0, 80) : 'Exercice',
      comments: typeof ex.comments === 'string' ? ex.comments.slice(0, 200) : '',
      coachTracking: (tracking.length > 0 ? tracking.slice(0, 12) : [{}]).map((s) => {
        const set = (s ?? {}) as Record<string, unknown>
        return {
          reps: String(set.reps ?? '').slice(0, 10),
          weight: String(set.weight ?? '').slice(0, 10),
          rpe: String(set.rpe ?? '').slice(0, 6),
        }
      }),
    }
  })
}

interface HistoryRow {
  date: string;
  exercise_name: string | null;
  tracking_data: AiSet[] | null;
  pain_level?: number | null;
  fatigue_score: number | null;
}

/** Résume l'historique récent en texte compact pour le contexte du prompt */
function buildHistoryContext(rows: HistoryRow[]): string {
  const parJour = new Map<string, HistoryRow[]>()
  for (const row of rows) {
    const lignes = parJour.get(row.date) ?? []
    lignes.push(row)
    parJour.set(row.date, lignes)
  }

  let out = ''
  for (const [date, lignes] of parJour) {
    const exos = lignes.filter((r) => r.exercise_name && !['Repos', 'Jour de Repos'].includes(r.exercise_name))
    if (exos.length === 0) {
      out += `${date}: repos\n`
      continue
    }
    const fatigue = lignes[0].fatigue_score
    out += `${date} (fatigue ${fatigue ?? '?'}/10):\n`
    for (const r of exos) {
      const sets = (r.tracking_data ?? [])
        .filter((s) => s?.reps && s?.weight)
        .map((s) => `${s.reps}x${s.weight}kg${s.rpe ? `@RPE${s.rpe}` : ''}`)
        .join(', ')
      if (!sets) continue // séance propagée non remplie : inutile pour le contexte
      const douleur = typeof r.pain_level === 'number' && r.pain_level > 0 ? ` [douleur lombaire ${r.pain_level}/3]` : ''
      out += `- ${r.exercise_name}: ${sets}${douleur}\n`
    }
  }
  // Borne de sécurité pour ne pas exploser le contexte du modèle
  return out.slice(0, 4000)
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé API Gemini absente côté serveur' }, { status: 500 })

    // Authentification : seul un utilisateur connecté peut consommer du quota Gemini
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: userData, error: authError } = await getSupabaseAdmin().auth.getUser(token)
    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Session expirée : recharge la page et reconnecte-toi' }, { status: 401 })
    }

    const body = (await req.json()) as { prompt?: unknown }
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return NextResponse.json({ error: 'Prompt vide' }, { status: 400 })
    if (prompt.length > 1000) {
      return NextResponse.json({ error: `Prompt trop long (${prompt.length}/1000 caractères)` }, { status: 400 })
    }

    // ——— Contexte : les 14 derniers jours d'entraînement de l'athlète ———
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - 14)
    const since = sinceDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

    const { data: historyData } = await getSupabaseAdmin()
      .from('workout_sets')
      .select('date, exercise_name, tracking_data, pain_level, fatigue_score')
      .gte('date', since)
      .lte('date', today)
      .order('date', { ascending: true })

    const historique = buildHistoryContext((historyData ?? []) as HistoryRow[])

    const genAI = new GoogleGenerativeAI(apiKey)

    const fullPrompt = `Tu es un coach expert en powerlifting. L'athlète est un pratiquant de force de haut niveau EN RÉÉDUCATION LOMBAIRE (suite de lumbago) : sois progressif et prudent sur Squat et Deadlift, surtout si l'historique montre des douleurs récentes ([douleur lombaire x/3]).

HISTORIQUE RÉEL DES 14 DERNIERS JOURS (reps x poids @ RPE) :
${historique || 'Aucun historique disponible.'}

CONSIGNE DE FORMAT : Réponds UNIQUEMENT par un tableau JSON pur, sans texte autour.
Format exact : [{"name": "Nom exercice", "coachTracking": [{"reps": "3", "weight": "180", "rpe": "8"}], "comments": "Conseil bref"}]
Appuie-toi sur l'historique pour choisir des charges cohérentes avec le niveau réel de l'athlète.

DEMANDE DE L'ATHLÈTE : ${prompt}`

    // Chaque modèle a son PROPRE quota gratuit (requêtes/minute et /jour).
    // Si flash-lite est saturé (429), on bascule immédiatement sur flash :
    // pas d'attente, quota séparé, l'utilisateur ne voit rien.
    const MODEL_CHAIN = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
    const isQuotaError = (msg: string) =>
      /429|quota|rate.?limit|resource.?exhausted|overloaded|503/i.test(msg)

    let responseText: string | null = null
    for (const modelName of MODEL_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          // Force une sortie JSON pure : élimine la principale cause d'échec de parsing
          generationConfig: { responseMimeType: 'application/json' },
        })
        const result = await model.generateContent(fullPrompt)
        responseText = result.response.text()
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!isQuotaError(msg)) throw e
        console.warn(`/api/coach : quota atteint sur ${modelName}, bascule sur le modèle suivant`)
      }
    }

    if (responseText === null) {
      return NextResponse.json({
        error: "Quota Gemini atteint sur tous les modèles. Réessaie dans 1-2 minutes ; si ça persiste, le quota journalier gratuit est épuisé (remise à zéro vers 9h, heure française).",
      }, { status: 429 })
    }

    // Parse direct (mode JSON) avec repli sur extraction de crochets
    let parsed: unknown
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const start = responseText.indexOf('[')
      const end = responseText.lastIndexOf(']')
      if (start === -1 || end <= start) throw new Error("L'IA n'a pas renvoyé de JSON exploitable — reformule ta demande")
      parsed = JSON.parse(responseText.substring(start, end + 1))
    }

    const data = sanitizeAiResponse(parsed)
    if (data.length === 0) {
      return NextResponse.json({ error: "L'IA n'a généré aucun exercice — reformule ta demande" }, { status: 502 })
    }
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('ERREUR /api/coach :', message)
    // Quota / rate limit Gemini : message actionnable au lieu d'un générique
    if (/429|quota|rate.?limit|resource.?exhausted/i.test(message)) {
      return NextResponse.json({ error: 'Quota Gemini atteint — réessaie dans une minute' }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
