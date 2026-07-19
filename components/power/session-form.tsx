'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toLocalDateStr, sessionTonnage, setsTonnage, bestE1RM, classifyLift, LIFT_SQUAT, LIFT_BENCH, LIFT_DEADLIFT, ACCESSORIES, PAIN_LEVELS, type SetData, type LiftCategory } from '@/lib/powerlifting'
import { Target, Activity, Check, Moon, Footprints, Battery, Coffee, Plus, Trash2, MessageSquare, X, Copy, RefreshCw, Award, Zap, Flame, Sparkles, ChevronUp, ChevronDown, Dumbbell, HeartPulse, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/power/toaster'

// ... (Garde exactement toutes tes interfaces Props, ExerciceRow, WorkoutSetRow, UserProgress et tes fonctions utilitaires type videSet) ...
interface Props { dateActive: Date; isRestDayMode: boolean; setIsRestDayMode: (val: boolean) => void; pasDuJour: number | null; }
interface ExerciceRow { id: string | null; uid: string; name: string; coachTracking: SetData[]; tracking: SetData[]; comments: string; painLevel: number | null; }
interface WorkoutSetRow { id: string; date: string; exercise_name: string | null; coach_tracking_data: SetData[] | null; tracking_data: SetData[] | null; comments: string | null; fatigue_score: number | null; sleep_hours: number | null; steps_count: number | null; order_index: number | null; pain_level?: number | null; coach_reps?: number | string | null; coach_weight?: number | string | null; coach_rpe?: number | string | null; }
interface UserProgress { id: string; level: number; current_xp: number; total_xp: number; streak_days: number | null; last_completed_date: string | null; }
const REST_NAMES = ['Repos', 'Jour de Repos']
const videSet = (): SetData => ({ reps: '', weight: '', rpe: '' })
const creerExerciceVierge = (): ExerciceRow => ({ id: null, uid: crypto.randomUUID(), name: '', coachTracking: [videSet()], tracking: [videSet()], comments: '', painLevel: null, })
const safeInt = (v: string, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback }
const safeFloat = (v: string, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }
const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function SessionForm({ dateActive, isRestDayMode, setIsRestDayMode, pasDuJour }: Props) {
  const [exercices, setExercices] = useState<ExerciceRow[]>([])
  const [fatigue, setFatigue] = useState(5)
  const [sommeil, setSommeil] = useState(8)
  const [pas, setPas] = useState(0)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [savePending, setSavePending] = useState(false)
  const savePendingRef = useRef(false)
  const [isOnline, setIsOnline] = useState(true)
  const marquerPending = (v: boolean) => { savePendingRef.current = v; setSavePending(v) }
  const [isValidating, setIsValidating] = useState(false)
  const [isPropagating, setIsPropagating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const loadedDateRef = useRef<string | null>(null)
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
  const suggestionsDuJour = useMemo(() => { switch (jourSemaine) { case 1: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]; case 2: return [...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]; case 3: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]; case 4: return [...LIFT_BENCH, ...ACCESSORIES]; case 6: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT]; default: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES] } }, [jourSemaine])

  const pasDuJourRef = useRef(pasDuJour)
  useEffect(() => { pasDuJourRef.current = pasDuJour; if (pasDuJour !== null) setPas(pasDuJour) }, [pasDuJour])

  // --- LOGIQUE DE CHARGEMENT & SAVE & IA IDENTIQUE (Je la laisse inchangée) ---
  useEffect(() => { let cancelled = false; loadedDateRef.current = null; const chargerSeance = async () => { const { data, error } = await supabase.from('workout_sets').select('*').eq('date', dateFormatee).order('order_index', { ascending: true }); if (cancelled) return; if (error) { toast('Erreur de chargement', 'error'); return } const rows = (data ?? []) as WorkoutSetRow[]; if (rows.length > 0) { const isExplicitRest = rows.some((item) => REST_NAMES.includes(item.exercise_name ?? '')); const vraisExercices = rows.filter((item) => !REST_NAMES.includes(item.exercise_name ?? '')); if (isExplicitRest && vraisExercices.length === 0) setIsRestDayMode(true); else if (vraisExercices.length > 0) setIsRestDayMode(false); else setIsRestDayMode(jourSemaine === 0 || jourSemaine === 5); if (vraisExercices.length > 0) { setExercices(vraisExercices.map((item) => { const fallbackCoach: SetData[] = item.coach_reps ? [{ reps: String(item.coach_reps), weight: item.coach_weight != null ? String(item.coach_weight) : '', rpe: item.coach_rpe != null ? String(item.coach_rpe) : '' }] : [videSet()]; const coachTracking = item.coach_tracking_data ?? fallbackCoach; const tracking = [...(item.tracking_data ?? [videSet()])]; while (tracking.length < coachTracking.length) tracking.push(videSet()); return { id: item.id, uid: crypto.randomUUID(), name: item.exercise_name ?? '', coachTracking, tracking, comments: item.comments ?? '', painLevel: item.pain_level ?? null, } })) } else { setExercices([creerExerciceVierge()]) } const derniereLigne = rows[rows.length - 1]; setFatigue(derniereLigne.fatigue_score ?? 5); setSommeil(derniereLigne.sleep_hours ?? 8); setPas(pasDuJourRef.current ?? derniereLigne.steps_count ?? 0) } else { setIsRestDayMode(jourSemaine === 0 || jourSemaine === 5); setExercices([creerExerciceVierge()]); setFatigue(5); setSommeil(8); setPas(pasDuJourRef.current ?? 0) } loadedDateRef.current = dateFormatee }; chargerSeance(); return () => { cancelled = true } }, [dateFormatee, jourSemaine, setIsRestDayMode])
  useEffect(() => { let cancelled = false; const fetchSemainePrec = async () => { const d = new Date(dateActive); d.setDate(d.getDate() - 7); const { data } = await supabase.from('workout_sets').select('tracking_data').eq('date', toLocalDateStr(d)); if (cancelled) return; const total = (data ?? []).reduce((sum, row) => sum + setsTonnage(row.tracking_data as SetData[] | null), 0); setTonnageSemainePrec(total > 0 ? Math.round(total) : null) }; fetchSemainePrec(); return () => { cancelled = true } }, [dateFormatee])
  const handleToggleMode = () => { if (!isRestDayMode && exercices.length > 0 && exercices[0].name !== '') { if (!confirm('Effacer la séance pour passer en Repos ?')) return } setIsRestDayMode(!isRestDayMode) }
  const executerSauvegarde = async (dateStr: string): Promise<boolean> => { if (typeof navigator !== 'undefined' && !navigator.onLine) return false; if (isRestDayMode) { const payload = { date: dateStr, exercise_name: 'Jour de Repos', fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas }; const del = await supabase.from('workout_sets').delete().eq('date', dateStr).neq('exercise_name', 'Jour de Repos'); if (del.error) return false; const { data, error: selError } = await supabase.from('workout_sets').select('id').eq('date', dateStr).limit(1); if (selError) return false; if (data && data.length > 0) { const { error } = await supabase.from('workout_sets').update(payload).eq('id', data[0].id); return !error } const { error } = await supabase.from('workout_sets').insert([payload]); return !error } const delRest = await supabase.from('workout_sets').delete().eq('date', dateStr).in('exercise_name', REST_NAMES); if (delRest.error) return false; const snapshot = exercices; type SaveResult = { data: { id: string } | null; error: { message: string } | null }; const sauver = async (includePain: boolean): Promise<SaveResult[]> => { const buildPayload = (ex: ExerciceRow, index: number) => { const payload: Record<string, unknown> = { date: dateStr, exercise_name: ex.name || 'Exercice Non Défini', coach_tracking_data: ex.coachTracking, tracking_data: ex.tracking, comments: ex.comments || null, fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas, order_index: index, }; if (includePain) payload.pain_level = ex.painLevel; return payload }; return Promise.all(snapshot.map(async (ex, index): Promise<SaveResult> => { if (ex.id) { const { error } = await supabase.from('workout_sets').update(buildPayload(ex, index)).eq('id', ex.id); return { data: null, error } } const { data, error } = await supabase.from('workout_sets').insert([buildPayload(ex, index)]).select('id').single(); return { data: data as { id: string } | null, error } })) }; let results = await sauver(painColumnOk.current); if (painColumnOk.current && results.some((r) => r.error?.message?.includes('pain_level'))) { painColumnOk.current = false; results = await sauver(false) } const idByUid = new Map<string, string>(); snapshot.forEach((ex, i) => { const r = results[i]; if (!ex.id && r?.data?.id) idByUid.set(ex.uid, r.data.id) }); if (idByUid.size > 0) { setExercices((prev) => prev.map((ex) => { const newId = idByUid.get(ex.uid); return newId ? { ...ex, id: newId } : ex })) } return results.every((r) => !r.error) }
  useEffect(() => { if (loadedDateRef.current !== dateFormatee) return; if (!isRestDayMode && exercices.length === 0) return; const timeoutId = setTimeout(async () => { const ok = await executerSauvegarde(dateFormatee); if (ok) { setLastSaved(new Date()); if (savePendingRef.current) marquerPending(false) } else { marquerPending(true) } }, 1500); return () => clearTimeout(timeoutId) }, [exercices, fatigue, sommeil, pas, isRestDayMode, dateFormatee])
  const sauvegardeRef = useRef(executerSauvegarde); useEffect(() => { sauvegardeRef.current = executerSauvegarde })
  useEffect(() => { setIsOnline(navigator.onLine); const onOnline = async () => { setIsOnline(true); if (!savePendingRef.current || loadedDateRef.current === null) return; const ok = await sauvegardeRef.current(loadedDateRef.current); if (ok) { marquerPending(false); setLastSaved(new Date()); toast('Synchronisé', 'success') } }; const onOffline = () => setIsOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) } }, [])
  const handleAIGeneration = async () => { if (!aiPrompt.trim()) return; let aiConsent = false; try { aiConsent = localStorage.getItem('powerapp_ai_consent') === '1' } catch { } if (!aiConsent) { const ok = confirm("Autoriser l'IA ?"); if (!ok) return; try { localStorage.setItem('powerapp_ai_consent', '1') } catch { } } setIsGenerating(true); try { const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ai-consent': '1' }, body: JSON.stringify({ prompt: aiPrompt }), }); if (!res.ok) throw new Error('Erreur API'); const aiData = (await res.json()) as { name: string; comments: string; coachTracking: SetData[] }[]; const newExercices: ExerciceRow[] = aiData.map((ex) => { const coachTracking = ex.coachTracking?.length ? ex.coachTracking : [videSet()]; return { id: null, uid: crypto.randomUUID(), name: ex.name, comments: ex.comments || '', coachTracking, tracking: coachTracking.map(() => videSet()), painLevel: null, } }); setExercices((prev) => prev.length === 1 && prev[0].name === '' ? newExercices : [...prev, ...newExercices]); setAiPrompt('') } catch (e) { toast('Erreur IA', 'error') } finally { setIsGenerating(false) } }
  const validerMission = async () => { setIsValidating(true); const savedOk = await executerSauvegarde(dateFormatee); if (!savedOk) { marquerPending(true); toast('Sauvegarde impossible', 'error'); setIsValidating(false); return } try { const { data } = await supabase.from('user_progress').select('*').limit(1).single(); const progress = data as UserProgress | null; if (!progress) throw new Error('Profil introuvable'); if (progress.last_completed_date === dateFormatee) { toast('Déjà validé !', 'info'); return } const currentStreak = progress.streak_days ?? 0; let newStreak = currentStreak; const today = new Date(dateFormatee); const lastDate = progress.last_completed_date ? new Date(progress.last_completed_date) : null; if (lastDate) { const diffTime = Math.abs(today.getTime() - lastDate.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays === 1) { newStreak += 1 } else if (diffDays > 1) { let brokeStreak = false; for (let i = 1; i < diffDays; i++) { const missingDate = new Date(lastDate); missingDate.setDate(missingDate.getDate() + i); const missingDay = missingDate.getDay(); if (missingDay !== 0 && missingDay !== 5) { brokeStreak = true; break } } newStreak = brokeStreak ? 1 : newStreak + 1 } } else { newStreak = 1 } let baseXP = 0; if (isRestDayMode) { baseXP = 50 } else { baseXP += 50; if (pas >= 8000) baseXP += 25; if (sommeil >= 7.5) baseXP += 25; const hasMainLifts = exercices.some((ex) => LIFT_SQUAT.includes(ex.name) || LIFT_BENCH.includes(ex.name) || LIFT_DEADLIFT.includes(ex.name)); if (hasMainLifts) baseXP += 50; const hasAccessories = exercices.some((ex) => ACCESSORIES.includes(ex.name)); if (hasAccessories) baseXP += 50 } let multiplier = 1; if (newStreak >= 7) multiplier = 1.5; else if (newStreak >= 5) multiplier = 1.25; else if (newStreak >= 3) multiplier = 1.1; const finalXP = Math.round(baseXP * multiplier); let newLevel = progress.level; let newCurrentXP = progress.current_xp + finalXP; const newTotalXP = progress.total_xp + finalXP; let xpNeeded = newLevel * 1000; let aLevelUp = false; while (newCurrentXP >= xpNeeded) { newCurrentXP -= xpNeeded; newLevel += 1; xpNeeded = newLevel * 1000; aLevelUp = true } await supabase.from('user_progress').update({ level: newLevel, current_xp: newCurrentXP, total_xp: newTotalXP, streak_days: newStreak, last_completed_date: dateFormatee, }).eq('id', progress.id); window.dispatchEvent(new Event('user-progress-updated')); setXpGained(finalXP); setNewStreakState(newStreak); setLeveledUp(aLevelUp); setShowModal(true) } catch (e) { toast('Erreur', 'error') } finally { setIsValidating(false) } }
  const propagerSemaine1VersBloc = async () => { if (!confirm('Propager sur 4 semaines ?')) return; setIsPropagating(true); try { const savedOk = await executerSauvegarde(dateFormatee); if (!savedOk) throw new Error('Sauvegarde impossible'); const { data: semaine1Data, error: fetchError } = await supabase.from('workout_sets').select('*').eq('date', dateFormatee); if (fetchError) throw fetchError; if (!semaine1Data || semaine1Data.length === 0) throw new Error('Vide'); const deltas = [7, 14, 21, 28]; const insertions: Record<string, unknown>[] = []; for (const delta of deltas) { const dateCible = new Date(dateActive); dateCible.setDate(dateCible.getDate() + delta); const dateCibleStr = toLocalDateStr(dateCible); await supabase.from('workout_sets').delete().eq('date', dateCibleStr); for (const item of semaine1Data as WorkoutSetRow[]) { const { id: _id, ...dataToCopy } = item as WorkoutSetRow & { created_at?: string }; delete (dataToCopy as { created_at?: string }).created_at; insertions.push({ ...dataToCopy, date: dateCibleStr }) } } const { error: insertError } = await supabase.from('workout_sets').insert(insertions); if (insertError) throw insertError; toast('Propagé', 'success') } catch (e) { toast('Erreur', 'error') } finally { setIsPropagating(false) } }
  const reinitialiserFutur = async () => { if (!confirm("Tout effacer le futur ?")) return; setIsResetting(true); try { const demain = new Date(dateActive); demain.setDate(demain.getDate() + 1); const { error } = await supabase.from('workout_sets').delete().gte('date', toLocalDateStr(demain)); if (error) throw error; toast('Réinitialisé', 'success') } catch (e) { toast('Erreur', 'error') } finally { setIsResetting(false) } }

  const ajouterExercice = useCallback(() => { setExercices((prev) => [...prev, creerExerciceVierge()]) }, [])
  const supprimerExercice = useCallback(async (index: number, dbId: string | null) => { if (dbId) await supabase.from('workout_sets').delete().eq('id', dbId); setExercices((prev) => prev.filter((_, i) => i !== index)) }, [])
  const deplacerExercice = useCallback((index: number, direction: 'up' | 'down') => { setExercices((prev) => { const newIndex = direction === 'up' ? index - 1 : index + 1; if (newIndex < 0 || newIndex >= prev.length) return prev; const liste = [...prev]; [liste[index], liste[newIndex]] = [liste[newIndex], liste[index]]; return liste }) }, [])
  const patchExercice = useCallback((index: number, patch: Partial<ExerciceRow>) => { setExercices((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex))) }, [])
  const updateSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => { setExercices((prev) => prev.map((ex, i) => i === exIndex ? { ...ex, [list]: ex[list].map((s, j) => (j === setIndex ? { ...s, [champ]: valeur } : s)) } : ex)) }, [])
  const ajouterSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking') => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; if (list === 'coachTracking') return { ...ex, coachTracking: [...ex.coachTracking, videSet()], tracking: [...ex.tracking, videSet()] }; return { ...ex, tracking: [...ex.tracking, videSet()] } })) }, [])
  const supprimerSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; if (list === 'coachTracking') { const coachTracking = ex.coachTracking.filter((_, j) => j !== setIndex); const tracking = ex.tracking.length > coachTracking.length ? ex.tracking.filter((_, j) => j !== setIndex) : ex.tracking; return { ...ex, coachTracking, tracking } } return { ...ex, tracking: ex.tracking.filter((_, j) => j !== setIndex) } })) }, [])
  const copierCoach = useCallback((exIndex: number) => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; const tracking: SetData[] = ex.coachTracking.map((cSet, j) => ({ reps: cSet.reps, weight: cSet.weight, rpe: ex.tracking[j]?.rpe ?? '', })); if (ex.tracking.length > ex.coachTracking.length) { tracking.push(...ex.tracking.slice(ex.coachTracking.length)) } return { ...ex, tracking } })) }, [])
  const validerSerieCoach = useCallback((exIndex: number, setIndex: number) => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; const coach = ex.coachTracking[setIndex]; if (!coach) return ex; const tracking = ex.tracking.map((s, j) => j === setIndex ? { ...s, reps: coach.reps, weight: coach.weight } : s); return { ...ex, tracking } })); if (typeof navigator !== 'undefined') navigator.vibrate?.(50) }, [])

  const e1rmBaseline = useRef<Record<LiftCategory, number> | null>(null)
  useEffect(() => { let cancelled = false; const chargerBaseline = async () => { const since = new Date(); since.setMonth(since.getMonth() - 6); const { data, error } = await supabase.from('workout_sets').select('exercise_name, tracking_data').gte('date', toLocalDateStr(since)).not('tracking_data', 'is', null); if (cancelled || error) return; const maxes: Record<LiftCategory, number> = { squat: 0, bench: 0, deadlift: 0 }; for (const row of (data ?? []) as { exercise_name: string | null; tracking_data: SetData[] | null }[]) { const cat = classifyLift(row.exercise_name); if (!cat) continue; const best = bestE1RM(row.tracking_data); if (best > maxes[cat]) maxes[cat] = best } e1rmBaseline.current = maxes }; chargerBaseline(); return () => { cancelled = true } }, [])
  useEffect(() => { if (isRestDayMode) return; const timeoutId = setTimeout(() => { const baseline = e1rmBaseline.current; if (!baseline) return; for (const ex of exercices) { const cat = classifyLift(ex.name); if (!cat) continue; const e1rm = bestE1RM(ex.tracking); if (e1rm <= baseline[cat]) continue; const ancien = Math.round(baseline[cat]); baseline[cat] = e1rm; if (ancien > 0) { toast(`PR estimé sur ${ex.name} ! ≈ ${Math.round(e1rm)} kg`, 'pr'); if (typeof navigator !== 'undefined') navigator.vibrate?.([80, 60, 80]) } } }, 1200); return () => clearTimeout(timeoutId) }, [exercices, isRestDayMode])

  const tonnageJour = useMemo(() => sessionTonnage(exercices), [exercices])
  const deltaTonnage = tonnageSemainePrec ? Math.round(((tonnageJour - tonnageSemainePrec) / tonnageSemainePrec) * 100) : null
  const listId = `liste-exos-${jourSemaine}`

  // --- RENDU BRUTALISTE ---
  return (
    <div className="space-y-6 animate-in fade-in pb-10">

      {/* Header Mode */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-zinc-950 p-6 rounded-2xl border border-zinc-900 gap-6">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
            {isRestDayMode ? <Coffee className="size-5" /> : <Activity className="size-5" />}
            {isRestDayMode ? 'RÉCUPÉRATION' : `SÉANCE DU ${dateActive.toLocaleDateString('fr-FR')}`}
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-zinc-900 p-1 rounded-xl w-full sm:w-auto justify-center">
          <button onClick={handleToggleMode} className={cn("px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", !isRestDayMode ? "bg-white text-black shadow-sm" : "text-zinc-500")}>
            SÉANCE
          </button>
          <button onClick={handleToggleMode} className={cn("px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", isRestDayMode ? "bg-white text-black shadow-sm" : "text-zinc-500")}>
            REPOS
          </button>
        </div>
      </div>

      {isRestDayMode ? (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-col items-center text-center space-y-4">
            <Coffee className="size-8 text-white mb-2" />
            <h2 className="text-2xl font-black uppercase tracking-widest text-white">REPOS ACTIF</h2>
          </div>

          <DailyMetrics fatigue={fatigue} sommeil={sommeil} pas={pas} setFatigue={setFatigue} setSommeil={setSommeil} setPas={setPas} />

          <button onClick={validerMission} disabled={isValidating} className="w-full p-6 rounded-full font-black text-sm uppercase tracking-widest bg-white hover:bg-zinc-200 text-black transition-all flex justify-center items-center gap-3">
            {isValidating ? <RefreshCw className="size-5 animate-spin" /> : <><Award className="size-5" /> VALIDER LE REPOS</>}
          </button>
        </div>
      ) : (

      <div className="space-y-6 animate-in fade-in">
        {/* IA Assistant */}
        <div className="flex flex-col sm:flex-row gap-3 p-2 bg-zinc-950 border border-zinc-900 rounded-2xl">
          <div className="flex-1 flex items-center gap-3 bg-zinc-900 px-4 py-3 rounded-xl">
            <Sparkles className="size-4 text-white shrink-0" />
            <input type="text" maxLength={1000} placeholder="GÉNÉRER AVEC L'IA (EX: 3X3 SQUAT 180...)" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAIGeneration() }} className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600 text-[10px] uppercase font-bold tracking-widest" disabled={isGenerating} />
          </div>
          <button onClick={handleAIGeneration} disabled={isGenerating || !aiPrompt.trim()} className="px-8 py-3 bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[10px] uppercase tracking-widest font-black rounded-xl transition-colors">
            {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : 'GÉNÉRER'}
          </button>
        </div>

        <datalist id={listId}>{suggestionsDuJour.map((nomExo) => <option key={nomExo} value={nomExo} />)}</datalist>

        {exercices.map((ex, exIndex) => (
          <ExerciseCard key={ex.uid} ex={ex} exIndex={exIndex} isLast={exIndex === exercices.length - 1} listId={listId} onPatch={patchExercice} onUpdateSerie={updateSerie} onAjouterSerie={ajouterSerie} onSupprimerSerie={supprimerSerie} onDeplacer={deplacerExercice} onSupprimer={supprimerExercice} onCopierCoach={copierCoach} onValiderSerie={validerSerieCoach} />
        ))}

        <button onClick={ajouterExercice} className="w-full py-6 border border-zinc-800 hover:border-white hover:bg-zinc-950 text-zinc-500 hover:text-white rounded-2xl flex items-center justify-center gap-2 transition-colors text-[10px] font-bold uppercase tracking-widest">
          <Plus className="size-4" /> Ajouter un exercice
        </button>

        <DailyMetrics fatigue={fatigue} sommeil={sommeil} pas={pas} setFatigue={setFatigue} setSommeil={setSommeil} setPas={setPas} />

        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Dumbbell className="size-4 text-white" /> Tonnage
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black tabular-nums text-white">{tonnageJour.toLocaleString('fr-FR')}</span>
            {deltaTonnage !== null && tonnageJour > 0 && (
              <span className="text-[10px] font-bold text-zinc-500">
                {deltaTonnage >= 0 ? '+' : ''}{deltaTonnage}% VS S-1
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="h-4 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {savePending ? <span className="text-white">EN ATTENTE DE SYNC...</span> : lastSaved && `SÉCURISÉ À ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={propagerSemaine1VersBloc} disabled={isPropagating} className="py-4 bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border border-zinc-900 transition-colors">
              <Copy className="size-4" /> Propager Bloc
            </button>
            <button onClick={reinitialiserFutur} disabled={isResetting} className="py-4 bg-zinc-950 hover:bg-zinc-900 text-red-500 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border border-zinc-900 transition-colors">
              <Trash2 className="size-4" /> Reset Futur
            </button>
          </div>

          <button onClick={validerMission} disabled={isValidating} className="w-full p-6 rounded-full font-black text-sm uppercase tracking-widest bg-white hover:bg-zinc-200 text-black transition-all flex justify-center items-center gap-3">
            {isValidating ? <RefreshCw className="size-5 animate-spin" /> : <><Award className="size-5" /> TERMINER LA SÉANCE</>}
          </button>
        </div>
      </div>
      )}

      {(!isOnline || savePending) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full border border-zinc-800 bg-black text-white text-[10px] font-bold uppercase tracking-widest shadow-xl whitespace-nowrap">
          HORS LIGNE — SYNC EN ATTENTE
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 max-w-sm w-full space-y-8 shadow-2xl">
            <div className="text-center space-y-4">
              <Award className="size-12 mx-auto text-white" />
              <h2 className="text-3xl font-black text-white tracking-widest">MISSION ACCOMPLIE</h2>
            </div>
            <div className="bg-zinc-900 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">XP Gagné</span><span className="text-xl font-black text-white tabular-nums">+{xpGained}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Série</span><span className="text-lg font-black text-white tabular-nums">{newStreakState} J</span></div>
            </div>
            {leveledUp && (<div className="text-white text-center font-black uppercase tracking-widest">LEVEL UP !</div>)}
            <button onClick={() => setShowModal(false)} className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-full font-black text-xs uppercase tracking-widest transition-colors">Fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DailyMetrics({ fatigue, sommeil, pas, setFatigue, setSommeil, setPas }: { fatigue: number; sommeil: number; pas: number; setFatigue: (v: number) => void; setSommeil: (v: number) => void; setPas: (v: number) => void; }) {
  return (
    <div className="p-6 sm:p-8 rounded-2xl border border-zinc-900 bg-zinc-950">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 ml-1">Fatigue (1-10)</span>
          <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(safeInt(e.target.value, 5))} className="w-full accent-white" />
            <span className="text-xl font-black text-white tabular-nums">{fatigue}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 ml-1">Sommeil (h)</span>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <input type="number" step="0.5" inputMode="decimal" value={sommeil} onChange={(e) => setSommeil(safeFloat(e.target.value))} className="w-full bg-transparent text-xl font-black tabular-nums text-white outline-none" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 ml-1">Pas</span>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <input type="number" inputMode="decimal" value={pas} onChange={(e) => setPas(safeInt(e.target.value))} className="w-full bg-transparent text-xl font-black tabular-nums text-white outline-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ExerciseCardProps { ex: ExerciceRow; exIndex: number; isLast: boolean; listId: string; onPatch: (index: number, patch: Partial<ExerciceRow>) => void; onUpdateSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => void; onAjouterSerie: (exIndex: number, list: 'coachTracking' | 'tracking') => void; onSupprimerSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => void; onDeplacer: (index: number, direction: 'up' | 'down') => void; onSupprimer: (index: number, dbId: string | null) => void; onCopierCoach: (exIndex: number) => void; onValiderSerie: (exIndex: number, setIndex: number) => void; }

const ExerciseCard = memo(function ExerciseCard({ ex, exIndex, isLast, listId, onPatch, onUpdateSerie, onAjouterSerie, onSupprimerSerie, onDeplacer, onSupprimer, onCopierCoach, onValiderSerie }: ExerciseCardProps) {
  const e1rmJour = classifyLift(ex.name) ? bestE1RM(ex.tracking) : 0
  return (
    <div className="p-4 sm:p-6 rounded-2xl border border-zinc-900 bg-zinc-950 space-y-6">

      <div className="flex items-center gap-3">
        <div className="bg-white text-black px-4 py-2 rounded-lg text-lg font-black tabular-nums">{exIndex + 1}</div>
        <input list={listId} placeholder="NOM DU MOUVEMENT" className="flex-1 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm font-black uppercase tracking-widest outline-none focus:border-white placeholder:text-zinc-600 transition-colors" value={ex.name} onChange={(e) => onPatch(exIndex, { name: e.target.value })} />

        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl">
          <button onClick={() => onDeplacer(exIndex, 'up')} disabled={exIndex === 0} className="p-3 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors border-r border-zinc-800"><ChevronUp className="size-4" /></button>
          <button onClick={() => onDeplacer(exIndex, 'down')} disabled={isLast} className="p-3 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"><ChevronDown className="size-4" /></button>
        </div>
        <button onClick={() => onSupprimer(exIndex, ex.id)} className="p-3 text-zinc-500 hover:text-red-500 bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"><Trash2 className="size-4" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prescription */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-black flex flex-col h-full">
          <h3 className="text-[10px] font-bold text-zinc-500 mb-4 uppercase tracking-widest">Prescription</h3>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
            <div className="w-6"></div><div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Reps</div><div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Poids</div><div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">RPE</div><div className="w-9"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.coachTracking.map((set, setIndex) => (
              <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                <span className="w-6 text-[10px] font-bold text-zinc-600 text-center uppercase tracking-widest">S{setIndex + 1}</span>
                <input type="text" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'reps', e.target.value)} className="w-full p-3 bg-zinc-900 rounded-lg text-zinc-300 text-sm font-black text-center outline-none focus:bg-zinc-800 tabular-nums" />
                <input type="text" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'weight', e.target.value)} className="w-full p-3 bg-zinc-900 rounded-lg text-white text-sm font-black text-center outline-none focus:bg-zinc-800 tabular-nums" />
                <input type="text" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'rpe', e.target.value)} className="w-full p-3 bg-zinc-900 rounded-lg text-zinc-300 text-sm font-black text-center outline-none focus:bg-zinc-800 tabular-nums" />
                <button onClick={() => onSupprimerSerie(exIndex, 'coachTracking', setIndex)} className="h-11 w-9 flex items-center justify-center text-zinc-600 hover:text-white transition-colors"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => onAjouterSerie(exIndex, 'coachTracking')} className="mt-4 w-full py-3 bg-zinc-900 text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">Ajouter</button>
        </div>

        {/* Validé */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-black flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Validé</h3>
            {e1rmJour > 0 && <span className="text-[10px] font-black text-white tabular-nums tracking-widest">E1RM: {Math.round(e1rmJour)}</span>}
          </div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-1.5 mb-2 px-1">
            <div className="w-5"></div><div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Reps</div><div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Poids</div><div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">RPE</div><div className="w-9"></div><div className="w-9"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.tracking.map((set, setIndex) => {
              const coach = ex.coachTracking[setIndex]; const coachRemplie = !!coach && (coach.reps !== '' || coach.weight !== ''); const serieFaite = coachRemplie && set.reps === coach.reps && set.weight === coach.weight
              return (
                <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-1.5 items-center">
                  <span className="w-5 text-[10px] font-bold text-zinc-600 text-center uppercase tracking-widest">S{setIndex + 1}</span>
                  <input type="text" inputMode="decimal" enterKeyHint="next" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'reps', e.target.value)} className="w-full p-3 bg-zinc-900 rounded-lg text-white text-sm font-black text-center outline-none focus:bg-zinc-800 tabular-nums focus:ring-1 focus:ring-white" />
                  <input type="text" inputMode="decimal" enterKeyHint="next" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'weight', e.target.value)} className="w-full p-3 bg-zinc-900 rounded-lg text-white text-sm font-black text-center outline-none focus:bg-zinc-800 tabular-nums focus:ring-1 focus:ring-white" />
                  <input type="text" inputMode="decimal" enterKeyHint="done" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'rpe', e.target.value)} className="w-full p-3 bg-zinc-900 rounded-lg text-white text-sm font-black text-center outline-none focus:bg-zinc-800 tabular-nums focus:ring-1 focus:ring-white" />
                  <button onClick={() => onValiderSerie(exIndex, setIndex)} disabled={!coachRemplie} className={cn('h-11 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-20', serieFaite ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 hover:text-white')}><Check className="size-4" /></button>
                  <button onClick={() => onSupprimerSerie(exIndex, 'tracking', setIndex)} className="h-11 w-9 flex items-center justify-center text-zinc-600 hover:text-white transition-colors"><X className="size-4" /></button>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onCopierCoach(exIndex)} className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">Copier Coach</button>
            <button onClick={() => onAjouterSerie(exIndex, 'tracking')} className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">+ Série Extra</button>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-900">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-1">Notes & Tempo</span>
        <input placeholder="EX: TEMPO 3-1-0..." value={ex.comments} onChange={(e) => onPatch(exIndex, { comments: e.target.value })} className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest text-white outline-none focus:border-white placeholder:text-zinc-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mr-2 ml-1">Douleur</span>
        {PAIN_LEVELS.map((p) => (
          <button key={p.value} onClick={() => onPatch(exIndex, { painLevel: ex.painLevel === p.value ? null : p.value })} className={cn('px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors', ex.painLevel === p.value ? 'bg-white text-black border-white' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white')}>
            {p.emoji} {p.label}
          </button>
        ))}
      </div>
    </div>
  )
})