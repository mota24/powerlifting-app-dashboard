'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  toLocalDateStr, sessionTonnage, setsTonnage,
  LIFT_SQUAT, LIFT_BENCH, LIFT_DEADLIFT, ACCESSORIES, PAIN_LEVELS,
  type SetData,
} from '@/lib/powerlifting'
import { Target, Activity, Check, Moon, Footprints, Battery, Coffee, Plus, Trash2, MessageSquare, X, Copy, RefreshCw, Award, Zap, Flame, Sparkles, ChevronUp, ChevronDown, Dumbbell, HeartPulse } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  dateActive: Date;
  isRestDayMode: boolean;
  setIsRestDayMode: (val: boolean) => void;
  pasDuJour: number | null;
}

interface ExerciceRow {
  id: string | null;      // id en base (null tant que non sauvegardé)
  uid: string;            // clé React stable, indépendante de la position
  name: string;
  coachTracking: SetData[];
  tracking: SetData[];
  comments: string;
  painLevel: number | null;
}

/** Ligne brute de la table workout_sets */
interface WorkoutSetRow {
  id: string;
  date: string;
  exercise_name: string | null;
  coach_tracking_data: SetData[] | null;
  tracking_data: SetData[] | null;
  comments: string | null;
  fatigue_score: number | null;
  sleep_hours: number | null;
  steps_count: number | null;
  order_index: number | null;
  pain_level?: number | null;
  // Anciens champs (fallback historique)
  coach_reps?: number | string | null;
  coach_weight?: number | string | null;
  coach_rpe?: number | string | null;
}

interface UserProgress {
  id: string;
  level: number;
  current_xp: number;
  total_xp: number;
  streak_days: number | null;
  last_completed_date: string | null;
}

const REST_NAMES = ['Repos', 'Jour de Repos']

const videSet = (): SetData => ({ reps: '', weight: '', rpe: '' })
const creerExerciceVierge = (): ExerciceRow => ({
  id: null, uid: crypto.randomUUID(), name: '',
  coachTracking: [videSet()], tracking: [videSet()],
  comments: '', painLevel: null,
})

const safeInt = (v: string, fallback = 0) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}
const safeFloat = (v: string, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function SessionForm({ dateActive, isRestDayMode, setIsRestDayMode, pasDuJour }: Props) {

  const [exercices, setExercices] = useState<ExerciceRow[]>([])
  const [fatigue, setFatigue] = useState(5)
  const [sommeil, setSommeil] = useState(8)
  const [pas, setPas] = useState(0)

  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isPropagating, setIsPropagating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Verrou anti-course : l'auto-save n'est autorisé que si les données affichées
  // correspondent bien à la date active (fini le setTimeout(500) fragile).
  const loadedDateRef = useRef<string | null>(null)
  // La colonne pain_level nécessite la migration SQL ; si elle n'existe pas
  // encore, on la retire des payloads pour ne jamais bloquer une sauvegarde.
  const painColumnOk = useRef(true)

  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [xpGained, setXpGained] = useState(0)
  const [newStreakState, setNewStreakState] = useState(0)
  const [leveledUp, setLeveledUp] = useState(false)

  const [tonnageSemainePrec, setTonnageSemainePrec] = useState<number | null>(null)

  const dateFormatee = toLocalDateStr(dateActive)
  const jourSemaine = dateActive.getDay()

  const suggestionsDuJour = useMemo(() => {
    switch (jourSemaine) {
      case 1: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]
      case 2: return [...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
      case 3: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]
      case 4: return [...LIFT_BENCH, ...ACCESSORIES]
      case 6: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT]
      default: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
    }
  }, [jourSemaine])

  // Priorité des pas : seances_pas (sync iPhone) > steps_count de workout_sets.
  // Le ref permet à chargerSeance (qui résout souvent APRÈS) de ne pas écraser
  // la valeur synchronisée avec le 0 stocké dans workout_sets.
  const pasDuJourRef = useRef(pasDuJour)
  useEffect(() => {
    pasDuJourRef.current = pasDuJour
    if (pasDuJour !== null) setPas(pasDuJour)
  }, [pasDuJour])

  // ————— Chargement de la séance du jour (annulable) —————
  useEffect(() => {
    let cancelled = false
    loadedDateRef.current = null

    const chargerSeance = async () => {
      const { data } = await supabase
        .from('workout_sets').select('*')
        .eq('date', dateFormatee)
        .order('order_index', { ascending: true })

      if (cancelled) return
      const rows = (data ?? []) as WorkoutSetRow[]

      if (rows.length > 0) {
        const isExplicitRest = rows.some((item) => REST_NAMES.includes(item.exercise_name ?? ''))
        const vraisExercices = rows.filter((item) => !REST_NAMES.includes(item.exercise_name ?? ''))

        if (isExplicitRest && vraisExercices.length === 0) setIsRestDayMode(true)
        else if (vraisExercices.length > 0) setIsRestDayMode(false)
        else setIsRestDayMode(jourSemaine === 0 || jourSemaine === 5)

        if (vraisExercices.length > 0) {
          setExercices(vraisExercices.map((item) => {
            const fallbackCoach: SetData[] = item.coach_reps
              ? [{ reps: String(item.coach_reps), weight: item.coach_weight != null ? String(item.coach_weight) : '', rpe: item.coach_rpe != null ? String(item.coach_rpe) : '' }]
              : [videSet()]
            const coachTracking = item.coach_tracking_data ?? fallbackCoach
            const tracking = [...(item.tracking_data ?? [videSet()])]
            while (tracking.length < coachTracking.length) tracking.push(videSet())

            return {
              id: item.id, uid: crypto.randomUUID(),
              name: item.exercise_name ?? '',
              coachTracking, tracking,
              comments: item.comments ?? '',
              painLevel: item.pain_level ?? null,
            }
          }))
        } else {
          setExercices([creerExerciceVierge()])
        }

        const derniereLigne = rows[rows.length - 1]
        setFatigue(derniereLigne.fatigue_score ?? 5)
        setSommeil(derniereLigne.sleep_hours ?? 8)
        setPas(pasDuJourRef.current ?? derniereLigne.steps_count ?? 0)
      } else {
        setIsRestDayMode(jourSemaine === 0 || jourSemaine === 5)
        setExercices([creerExerciceVierge()])
        setFatigue(5); setSommeil(8); setPas(pasDuJourRef.current ?? 0)
      }

      loadedDateRef.current = dateFormatee
    }

    chargerSeance()
    return () => { cancelled = true }
  }, [dateFormatee, jourSemaine, setIsRestDayMode])

  // ————— Tonnage de la même journée, semaine précédente (comparaison) —————
  useEffect(() => {
    let cancelled = false
    const fetchSemainePrec = async () => {
      const d = new Date(dateActive)
      d.setDate(d.getDate() - 7)
      const { data } = await supabase
        .from('workout_sets').select('tracking_data')
        .eq('date', toLocalDateStr(d))
      if (cancelled) return
      const total = (data ?? []).reduce(
        (sum, row) => sum + setsTonnage(row.tracking_data as SetData[] | null), 0
      )
      setTonnageSemainePrec(total > 0 ? Math.round(total) : null)
    }
    fetchSemainePrec()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFormatee])

  const handleToggleMode = () => {
    if (!isRestDayMode && exercices.length > 0 && exercices[0].name !== '') {
      if (!confirm('Passer en mode Repos va effacer la séance en cours. Es-tu sûr ?')) return
    }
    setIsRestDayMode(!isRestDayMode)
  }

  // ————— Sauvegarde —————
  const executerSauvegarde = async (dateStr: string) => {
    if (isRestDayMode) {
      const payload = { date: dateStr, exercise_name: 'Jour de Repos', fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas }
      await supabase.from('workout_sets').delete().eq('date', dateStr).neq('exercise_name', 'Jour de Repos')
      const { data } = await supabase.from('workout_sets').select('id').eq('date', dateStr).limit(1)
      if (data && data.length > 0) await supabase.from('workout_sets').update(payload).eq('id', data[0].id)
      else await supabase.from('workout_sets').insert([payload])
      return
    }

    await supabase.from('workout_sets').delete().eq('date', dateStr).in('exercise_name', REST_NAMES)

    const snapshot = exercices
    type SaveResult = { data: { id: string } | null; error: { message: string } | null }

    const sauver = async (includePain: boolean): Promise<SaveResult[]> => {
      const buildPayload = (ex: ExerciceRow, index: number) => {
        const payload: Record<string, unknown> = {
          date: dateStr,
          exercise_name: ex.name || 'Exercice Non Défini',
          coach_tracking_data: ex.coachTracking,
          tracking_data: ex.tracking,
          comments: ex.comments || null,
          fatigue_score: fatigue,
          sleep_hours: sommeil,
          steps_count: pas,
          order_index: index,
        }
        if (includePain) payload.pain_level = ex.painLevel
        return payload
      }
      return Promise.all(snapshot.map(async (ex, index): Promise<SaveResult> => {
        if (ex.id) {
          const { error } = await supabase.from('workout_sets').update(buildPayload(ex, index)).eq('id', ex.id)
          return { data: null, error }
        }
        const { data, error } = await supabase.from('workout_sets').insert([buildPayload(ex, index)]).select('id').single()
        return { data: data as { id: string } | null, error }
      }))
    }

    let results = await sauver(painColumnOk.current)
    if (painColumnOk.current && results.some((r) => r.error?.message?.includes('pain_level'))) {
      painColumnOk.current = false // migration SQL pas encore exécutée : on continue sans le drapeau douleur
      results = await sauver(false)
    }

    // Réconciliation des ids fraîchement insérés, par uid (insensible aux réordonnancements)
    const idByUid = new Map<string, string>()
    snapshot.forEach((ex, i) => {
      const r = results[i]
      if (!ex.id && r?.data?.id) idByUid.set(ex.uid, r.data.id)
    })
    if (idByUid.size > 0) {
      setExercices((prev) => prev.map((ex) => {
        const newId = idByUid.get(ex.uid)
        return newId ? { ...ex, id: newId } : ex
      }))
    }
  }

  // ————— Auto-save (verrouillé par date) —————
  useEffect(() => {
    if (loadedDateRef.current !== dateFormatee) return
    if (!isRestDayMode && exercices.length === 0) return
    const timeoutId = setTimeout(async () => {
      await executerSauvegarde(dateFormatee)
      setLastSaved(new Date())
    }, 1500)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercices, fatigue, sommeil, pas, isRestDayMode, dateFormatee])

  // ————— Génération IA —————
  const handleAIGeneration = async () => {
    if (!aiPrompt.trim()) return
    setIsGenerating(true)
    try {
      // L'authentification passe par le cookie httpOnly envoyé automatiquement
      // (same-origin) : le JavaScript ne détient plus aucun jeton.
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      if (!res.ok) {
        // On remonte le message précis du serveur (session expirée, prompt trop
        // long, quota Gemini…) au lieu d'une erreur générique inutilisable.
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Erreur serveur (${res.status})`)
      }
      const aiData = (await res.json()) as { name: string; comments: string; coachTracking: SetData[] }[]
      const newExercices: ExerciceRow[] = aiData.map((ex) => {
        const coachTracking = ex.coachTracking?.length ? ex.coachTracking : [videSet()]
        return {
          id: null, uid: crypto.randomUUID(),
          name: ex.name, comments: ex.comments || '',
          coachTracking, tracking: coachTracking.map(() => videSet()),
          painLevel: null,
        }
      })
      setExercices((prev) =>
        prev.length === 1 && prev[0].name === '' ? newExercices : [...prev, ...newExercices]
      )
      setAiPrompt('')
    } catch (e) {
      alert('Génération impossible : ' + errMessage(e))
    } finally {
      setIsGenerating(false)
    }
  }

  // ————— Validation de mission (XP / Streak) —————
  const validerMission = async () => {
    setIsValidating(true)
    await executerSauvegarde(dateFormatee)
    try {
      const { data } = await supabase.from('user_progress').select('*').limit(1).single()
      const progress = data as UserProgress | null
      if (!progress) throw new Error('Profil joueur introuvable')
      if (progress.last_completed_date === dateFormatee) {
        alert('Tu as déjà validé ta mission pour cette journée !')
        return
      }
      const currentStreak = progress.streak_days ?? 0
      let newStreak = currentStreak
      const today = new Date(dateFormatee)
      const lastDate = progress.last_completed_date ? new Date(progress.last_completed_date) : null
      if (lastDate) {
        const diffTime = Math.abs(today.getTime() - lastDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          newStreak += 1
        } else if (diffDays > 1) {
          let brokeStreak = false
          for (let i = 1; i < diffDays; i++) {
            const missingDate = new Date(lastDate)
            missingDate.setDate(missingDate.getDate() + i)
            const missingDay = missingDate.getDay()
            if (missingDay !== 0 && missingDay !== 5) { brokeStreak = true; break }
          }
          newStreak = brokeStreak ? 1 : newStreak + 1
        }
      } else { newStreak = 1 }

      let baseXP = 0
      if (isRestDayMode) {
        baseXP = 50
      } else {
        baseXP += 50
        if (pas >= 8000) baseXP += 25
        if (sommeil >= 7.5) baseXP += 25
        const hasMainLifts = exercices.some((ex) => LIFT_SQUAT.includes(ex.name) || LIFT_BENCH.includes(ex.name) || LIFT_DEADLIFT.includes(ex.name))
        if (hasMainLifts) baseXP += 50
        const hasAccessories = exercices.some((ex) => ACCESSORIES.includes(ex.name))
        if (hasAccessories) baseXP += 50
      }
      let multiplier = 1
      if (newStreak >= 7) multiplier = 1.5
      else if (newStreak >= 5) multiplier = 1.25
      else if (newStreak >= 3) multiplier = 1.1
      const finalXP = Math.round(baseXP * multiplier)

      let newLevel = progress.level
      let newCurrentXP = progress.current_xp + finalXP
      const newTotalXP = progress.total_xp + finalXP
      let xpNeeded = newLevel * 1000
      let aLevelUp = false
      while (newCurrentXP >= xpNeeded) {
        newCurrentXP -= xpNeeded
        newLevel += 1
        xpNeeded = newLevel * 1000
        aLevelUp = true
      }
      await supabase.from('user_progress').update({
        level: newLevel, current_xp: newCurrentXP, total_xp: newTotalXP, streak_days: newStreak, last_completed_date: dateFormatee,
      }).eq('id', progress.id)

      // Prévient le header (barre XP) : remplace l'ancien canal Realtime,
      // devenu impossible sans jeton accessible au JavaScript.
      window.dispatchEvent(new Event('user-progress-updated'))

      setXpGained(finalXP); setNewStreakState(newStreak); setLeveledUp(aLevelUp); setShowModal(true)
    } catch (e) {
      alert('Erreur lors de la validation : ' + errMessage(e))
    } finally {
      setIsValidating(false)
    }
  }

  // ————— Propagation & réinitialisation —————
  const propagerSemaine1VersBloc = async () => {
    if (!confirm('Voulez-vous sauvegarder cette séance ET la copier sur les 4 prochaines semaines du bloc ?')) return
    setIsPropagating(true)
    try {
      await executerSauvegarde(dateFormatee)
      const { data: semaine1Data, error: fetchError } = await supabase.from('workout_sets').select('*').eq('date', dateFormatee)
      if (fetchError) throw fetchError
      if (!semaine1Data || semaine1Data.length === 0) throw new Error('Aucune donnée enregistrée.')
      const deltas = [7, 14, 21, 28]
      const insertions: Record<string, unknown>[] = []
      for (const delta of deltas) {
        const dateCible = new Date(dateActive)
        dateCible.setDate(dateCible.getDate() + delta)
        const dateCibleStr = toLocalDateStr(dateCible)
        await supabase.from('workout_sets').delete().eq('date', dateCibleStr)
        for (const item of semaine1Data as WorkoutSetRow[]) {
          const { id: _id, ...dataToCopy } = item as WorkoutSetRow & { created_at?: string }
          delete (dataToCopy as { created_at?: string }).created_at
          insertions.push({ ...dataToCopy, date: dateCibleStr })
        }
      }
      const { error: insertError } = await supabase.from('workout_sets').insert(insertions)
      if (insertError) throw insertError
      alert('Succès ! La séance a été propagée.')
    } catch (e) {
      alert('Erreur : ' + errMessage(e))
    } finally {
      setIsPropagating(false)
    }
  }

  const reinitialiserFutur = async () => {
    if (!confirm("ATTENTION : Es-tu sûr de vouloir supprimer TOUTES les séances prévues après la date d'aujourd'hui ?")) return
    setIsResetting(true)
    try {
      const demain = new Date(dateActive)
      demain.setDate(demain.getDate() + 1)
      const { error } = await supabase.from('workout_sets').delete().gte('date', toLocalDateStr(demain))
      if (error) throw error
      alert('Toutes les séances futures ont été réinitialisées avec succès.')
    } catch (e) {
      alert('Erreur lors de la réinitialisation : ' + errMessage(e))
    } finally {
      setIsResetting(false)
    }
  }

  // ————— Mutations d'état : toutes immuables et stables (React.memo fonctionne) —————
  const ajouterExercice = useCallback(() => {
    setExercices((prev) => [...prev, creerExerciceVierge()])
  }, [])

  const supprimerExercice = useCallback(async (index: number, dbId: string | null) => {
    if (dbId) await supabase.from('workout_sets').delete().eq('id', dbId)
    setExercices((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const deplacerExercice = useCallback((index: number, direction: 'up' | 'down') => {
    setExercices((prev) => {
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const liste = [...prev]
      ;[liste[index], liste[newIndex]] = [liste[newIndex], liste[index]]
      return liste
    })
  }, [])

  const patchExercice = useCallback((index: number, patch: Partial<ExerciceRow>) => {
    setExercices((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }, [])

  const updateSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => {
    setExercices((prev) => prev.map((ex, i) => i === exIndex
      ? { ...ex, [list]: ex[list].map((s, j) => (j === setIndex ? { ...s, [champ]: valeur } : s)) }
      : ex))
  }, [])

  const ajouterSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking') => {
    setExercices((prev) => prev.map((ex, i) => {
      if (i !== exIndex) return ex
      if (list === 'coachTracking') {
        return { ...ex, coachTracking: [...ex.coachTracking, videSet()], tracking: [...ex.tracking, videSet()] }
      }
      return { ...ex, tracking: [...ex.tracking, videSet()] }
    }))
  }, [])

  const supprimerSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => {
    setExercices((prev) => prev.map((ex, i) => {
      if (i !== exIndex) return ex
      if (list === 'coachTracking') {
        const coachTracking = ex.coachTracking.filter((_, j) => j !== setIndex)
        const tracking = ex.tracking.length > coachTracking.length
          ? ex.tracking.filter((_, j) => j !== setIndex)
          : ex.tracking
        return { ...ex, coachTracking, tracking }
      }
      return { ...ex, tracking: ex.tracking.filter((_, j) => j !== setIndex) }
    }))
  }, [])

  /**
   * Copie la prescription Coach dans la colonne Validé de CET exercice :
   * reps + poids uniquement. Le RPE athlète (et le drapeau douleur) restent
   * intacts pour être renseignés après l'effort. Les séries extra ajoutées
   * par l'athlète au-delà de la prescription sont conservées.
   */
  const copierCoach = useCallback((exIndex: number) => {
    setExercices((prev) => prev.map((ex, i) => {
      if (i !== exIndex) return ex
      const tracking: SetData[] = ex.coachTracking.map((cSet, j) => ({
        reps: cSet.reps,
        weight: cSet.weight,
        rpe: ex.tracking[j]?.rpe ?? '',
      }))
      if (ex.tracking.length > ex.coachTracking.length) {
        tracking.push(...ex.tracking.slice(ex.coachTracking.length))
      }
      return { ...ex, tracking }
    }))
  }, [])

  const tonnageJour = useMemo(() => sessionTonnage(exercices), [exercices])
  const deltaTonnage = tonnageSemainePrec
    ? Math.round(((tonnageJour - tonnageSemainePrec) / tonnageSemainePrec) * 100)
    : null

  const listId = `liste-exos-${jourSemaine}`

  return (
    <div className="space-y-6 animate-in fade-in pb-10">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/80 p-4 rounded-xl border border-slate-700 shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            {isRestDayMode ? <Coffee className="size-5 text-emerald-500" /> : <Activity className="size-5 text-blue-500" />}
            {isRestDayMode ? 'Mode Récupération' : `Séance du ${dateActive.toLocaleDateString('fr-FR')}`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Gère la nature de ta journée.</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-lg border border-slate-800 w-full sm:w-auto justify-center">
          <span className={cn("text-xs font-bold uppercase tracking-wider", !isRestDayMode ? "text-blue-400" : "text-slate-500")}>Séance</span>
          <button
            onClick={handleToggleMode}
            className={cn("relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none shadow-inner border border-black/20", isRestDayMode ? "bg-emerald-500" : "bg-blue-600")}
          >
            <span className={cn("inline-block h-6 w-6 transform rounded-full bg-white transition duration-300 ease-in-out shadow-md", isRestDayMode ? "translate-x-9" : "translate-x-1")} />
          </button>
          <span className={cn("text-xs font-bold uppercase tracking-wider", isRestDayMode ? "text-emerald-400" : "text-slate-500")}>Repos</span>
        </div>
      </div>

      {isRestDayMode ? (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-emerald-500/20 rounded-full"><Coffee className="size-8 text-emerald-400" /></div>
            <div>
              <h2 className="text-xl font-black text-emerald-400">Jour de Repos Activé</h2>
              <p className="text-sm text-slate-400 mt-1">Laisse ton système nerveux et ton dos récupérer. Maintiens ton Streak en dessous.</p>
            </div>
          </div>

          <DailyMetrics fatigue={fatigue} sommeil={sommeil} pas={pas} setFatigue={setFatigue} setSommeil={setSommeil} setPas={setPas} />

          <button onClick={validerMission} disabled={isValidating} className="w-full p-4 rounded-xl font-black text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex justify-center items-center gap-2">
            {isValidating ? <><RefreshCw className="size-5 animate-spin" /> VALIDATION...</> : <><Award className="size-6" /> VALIDER LE REPOS & GAGNER XP</>}
          </button>
        </div>
      ) : (

      <div className="space-y-6 animate-in fade-in">

        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl shadow-inner">
          <div className="flex-1 flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-lg border border-slate-800">
            <Sparkles className="size-5 text-blue-400 flex-shrink-0" />
            <input type="text" maxLength={1000} placeholder="Ex: 3x3 squat 180, puis 4x10 tractions..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAIGeneration() }} className="w-full bg-transparent text-white outline-none placeholder:text-slate-500 text-sm" disabled={isGenerating} />
          </div>
          <button onClick={handleAIGeneration} disabled={isGenerating || !aiPrompt.trim()} className="whitespace-nowrap px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
            {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : 'Générer avec l\'IA'}
          </button>
        </div>

        <datalist id={listId}>{suggestionsDuJour.map((nomExo) => <option key={nomExo} value={nomExo} />)}</datalist>

        {exercices.map((ex, exIndex) => (
          <ExerciseCard
            key={ex.uid}
            ex={ex}
            exIndex={exIndex}
            isLast={exIndex === exercices.length - 1}
            listId={listId}
            onPatch={patchExercice}
            onUpdateSerie={updateSerie}
            onAjouterSerie={ajouterSerie}
            onSupprimerSerie={supprimerSerie}
            onDeplacer={deplacerExercice}
            onSupprimer={supprimerExercice}
            onCopierCoach={copierCoach}
          />
        ))}

        <button onClick={ajouterExercice} className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:text-blue-400 text-slate-500 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
          <Plus className="size-5" /> Ajouter un exercice
        </button>

        <DailyMetrics fatigue={fatigue} sommeil={sommeil} pas={pas} setFatigue={setFatigue} setSommeil={setSommeil} setPas={setPas} />

        {/* Tonnage : charge de travail totale de la séance */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-400 flex items-center gap-2">
            <Dumbbell className="size-4 text-blue-500" /> Tonnage du jour
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black text-white">{tonnageJour.toLocaleString('fr-FR')} <span className="text-sm font-medium text-slate-500">kg</span></span>
            {deltaTonnage !== null && tonnageJour > 0 && (
              <span className={cn('text-xs font-bold', deltaTonnage >= 0 ? 'text-emerald-400' : 'text-orange-400')}>
                {deltaTonnage >= 0 ? '+' : ''}{deltaTonnage}% vs S-1
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="h-4 flex items-center justify-center text-xs font-medium text-slate-600">
            {lastSaved && `Sécurisé à ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={propagerSemaine1VersBloc}
              disabled={isPropagating}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors text-sm"
            >
              {isPropagating ? <RefreshCw className="size-4 animate-spin" /> : <Copy className="size-4" />} Propager sur le Bloc
            </button>

            <button
              onClick={reinitialiserFutur}
              disabled={isResetting}
              className="py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-900/30 transition-colors text-sm"
            >
              {isResetting ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Réinitialiser le futur
            </button>
          </div>

          <button onClick={validerMission} disabled={isValidating} className="w-full p-5 rounded-xl font-black text-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex justify-center items-center gap-2">
            {isValidating ? <><RefreshCw className="size-5 animate-spin" /> VALIDATION...</> : <><Award className="size-6" /> FIN DE SÉANCE - VALIDER LA MISSION</>}
          </button>
        </div>
      </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><Award className="size-8" /></div>
              <h2 className="text-2xl font-black text-white">MISSION ACCOMPLIE</h2>
              <p className="text-slate-400">Excellente discipline. Sécurise tes gains.</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 space-y-3 border border-slate-800">
              <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Zap className="size-4 text-yellow-400"/> XP Gagné</span><span className="text-xl font-black text-yellow-400">+{xpGained} XP</span></div>
              <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Flame className="size-4 text-orange-500"/> Série en cours</span><span className="text-lg font-bold text-orange-500">{newStreakState} Jours</span></div>
            </div>
            {leveledUp && (<div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-center font-bold text-sm">🌟 FÉLICITATIONS, TU AS GAGNÉ UN NIVEAU ! 🌟</div>)}
            <button onClick={() => setShowModal(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">Fermer le rapport</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ————————————————————————————————————————————————
// Métriques quotidiennes (Fatigue / Sommeil / Pas) — bloc réutilisé séance & repos
// ————————————————————————————————————————————————
function DailyMetrics({ fatigue, sommeil, pas, setFatigue, setSommeil, setPas }: {
  fatigue: number; sommeil: number; pas: number;
  setFatigue: (v: number) => void; setSommeil: (v: number) => void; setPas: (v: number) => void;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
      <h3 className="text-sm font-bold text-slate-400 mb-4">Suivi quotidien</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex flex-col w-full">
            <span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Battery className="size-3 text-red-500"/> Fatigue</span>
            <input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(safeInt(e.target.value, 5))} className="w-full accent-red-500" />
          </div>
          <span className="text-lg font-bold ml-4 text-white w-6 text-right">{fatigue}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Moon className="size-3 text-indigo-400"/> Sommeil</span>
            <input type="number" step="0.5" value={sommeil} onChange={(e) => setSommeil(safeFloat(e.target.value))} className="w-16 bg-transparent text-lg font-bold text-white outline-none" />
          </div>
          <span className="text-xs text-slate-500">h</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Footprints className="size-3 text-orange-400"/> Pas</span>
            <input type="number" value={pas} onChange={(e) => setPas(safeInt(e.target.value))} className="w-full bg-transparent text-lg font-bold text-white outline-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ————————————————————————————————————————————————
// Carte exercice — mémoïsée : seule la carte éditée re-rend
// ————————————————————————————————————————————————
interface ExerciseCardProps {
  ex: ExerciceRow;
  exIndex: number;
  isLast: boolean;
  listId: string;
  onPatch: (index: number, patch: Partial<ExerciceRow>) => void;
  onUpdateSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => void;
  onAjouterSerie: (exIndex: number, list: 'coachTracking' | 'tracking') => void;
  onSupprimerSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => void;
  onDeplacer: (index: number, direction: 'up' | 'down') => void;
  onSupprimer: (index: number, dbId: string | null) => void;
  onCopierCoach: (exIndex: number) => void;
}

const ExerciseCard = memo(function ExerciseCard({
  ex, exIndex, isLast, listId,
  onPatch, onUpdateSerie, onAjouterSerie, onSupprimerSerie, onDeplacer, onSupprimer, onCopierCoach,
}: ExerciseCardProps) {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4 relative group shadow-sm">

      <div className="flex items-center gap-3">
        <div className="bg-slate-800 text-slate-400 px-3 py-1 rounded-md text-sm font-bold">{exIndex + 1}</div>
        <input list={listId} placeholder="Nom de l'exercice..." className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-blue-500 font-medium placeholder:text-slate-600" value={ex.name} onChange={(e) => onPatch(exIndex, { name: e.target.value })} />

        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg">
          <button onClick={() => onDeplacer(exIndex, 'up')} disabled={exIndex === 0} className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors border-r border-slate-800"><ChevronUp className="size-5" /></button>
          <button onClick={() => onDeplacer(exIndex, 'down')} disabled={isLast} className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronDown className="size-5" /></button>
        </div>

        <button onClick={() => onSupprimer(exIndex, ex.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="size-5" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col h-full">
          <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Target className="size-3" /> Prescription Coach</h3>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
            <div className="w-6"></div><div className="text-[10px] text-slate-500 uppercase text-center">Reps</div><div className="text-[10px] text-slate-500 uppercase text-center">Poids</div><div className="text-[10px] text-slate-500 uppercase text-center">RPE</div><div className="w-6"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.coachTracking.map((set, setIndex) => (
              <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                <span className="w-6 text-xs font-bold text-slate-600 text-center">S{setIndex + 1}</span>
                {/* type="text" pour permettre les notations libres "3/4/5" */}
                <input type="text" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'reps', e.target.value)} className="w-full p-2 bg-slate-900/50 rounded-md text-slate-300 text-center outline-none focus:bg-slate-800 transition-colors" />
                <input type="text" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'weight', e.target.value)} className="w-full p-2 bg-slate-900/50 rounded-md text-slate-300 text-center outline-none focus:bg-slate-800 transition-colors" />
                <input type="text" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-slate-900/50 rounded-md text-slate-300 text-center outline-none focus:bg-slate-800 transition-colors" />
                <button onClick={() => onSupprimerSerie(exIndex, 'coachTracking', setIndex)} className="w-6 flex justify-center text-slate-500 hover:text-red-500 transition-colors"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => onAjouterSerie(exIndex, 'coachTracking')} className="mt-3 w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"><Plus className="size-3" /> Ajouter une série prévue</button>
        </div>

        <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col h-full">
          <h3 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Check className="size-3" /> Validé</h3>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
            <div className="w-6"></div><div className="text-[10px] text-blue-500/70 uppercase text-center">Reps</div><div className="text-[10px] text-blue-500/70 uppercase text-center">Poids</div><div className="text-[10px] text-blue-500/70 uppercase text-center">RPE</div><div className="w-6"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.tracking.map((set, setIndex) => (
              <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                <span className="w-6 text-xs font-bold text-slate-500 text-center">S{setIndex + 1}</span>
                <input type="text" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'reps', e.target.value)} className="w-full p-2 bg-blue-950/20 rounded-md text-blue-100 text-center outline-none focus:bg-blue-900/40 transition-colors" />
                <input type="text" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'weight', e.target.value)} className="w-full p-2 bg-blue-950/20 rounded-md text-blue-100 text-center outline-none focus:bg-blue-900/40 transition-colors" />
                <input type="text" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-blue-950/20 rounded-md text-blue-100 text-center outline-none focus:bg-blue-900/40 transition-colors" />
                <button onClick={() => onSupprimerSerie(exIndex, 'tracking', setIndex)} className="w-6 flex justify-center text-slate-500 hover:text-red-500 transition-colors"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onCopierCoach(exIndex)}
              title="Recopie reps + poids de la prescription Coach (RPE et douleur restent à remplir)"
              className="flex-1 py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-blue-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="size-3" /> Copier le Coach
            </button>
            <button onClick={() => onAjouterSerie(exIndex, 'tracking')} className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"><Plus className="size-3" /> Série extra (Athlète)</button>
          </div>
        </div>
      </div>

      <div className="mt-2 pt-3 border-t border-slate-800/50">
        <div className="flex items-center gap-2 mb-2 text-slate-400"><MessageSquare className="size-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Notes & Tempo</span></div>
        <input placeholder="Ex: Tempo 3-1-0, douleur épaule..." value={ex.comments} onChange={(e) => onPatch(exIndex, { comments: e.target.value })} className="w-full p-2 bg-transparent border border-slate-800 rounded-md text-sm text-slate-300 outline-none focus:border-blue-500" />
      </div>

      {/* Drapeau douleur : suivi de désensibilisation (rééducation lombaire) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <HeartPulse className="size-3.5 text-rose-400" /> Douleur
        </span>
        {PAIN_LEVELS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPatch(exIndex, { painLevel: ex.painLevel === p.value ? null : p.value })}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-bold border transition-colors',
              ex.painLevel === p.value
                ? 'border-blue-500 bg-blue-500/10 text-white'
                : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
            )}
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>
    </div>
  )
})
