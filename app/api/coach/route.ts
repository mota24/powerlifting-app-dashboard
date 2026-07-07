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

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé API absente' }, { status: 500 })

    // Authentification : seul un utilisateur connecté peut consommer du quota Gemini
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: userData, error: authError } = await getSupabaseAdmin().auth.getUser(token)
    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    const body = (await req.json()) as { prompt?: unknown }
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt || prompt.length > 500) {
      return NextResponse.json({ error: 'Prompt invalide (500 caractères max)' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const result = await model.generateContent(`Tu es un expert powerlifting. Réponds UNIQUEMENT par un tableau JSON pur.
    Format attendu : [{"name": "Nom", "coachTracking": [{"reps": "3", "weight": "180", "rpe": "8"}], "comments": "IA"}]
    Demande utilisateur : ${prompt}`)

    const responseText = result.response.text()
    const start = responseText.indexOf('[')
    const end = responseText.lastIndexOf(']')
    if (start === -1 || end <= start) throw new Error('Aucun JSON dans la réponse IA')

    const data = sanitizeAiResponse(JSON.parse(responseText.substring(start, end + 1)))
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('ERREUR /api/coach :', message)
    return NextResponse.json({ error: 'Erreur IA' }, { status: 500 })
  }
}
