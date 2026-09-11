'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { toLocalDateStr, parseLocalDate, sessionTonnage, setsTonnage, bestE1RM, classifyLift, suggestionsExercices, ACCESSORIES, FIT_ACCESSOIRES, PAIN_LEVELS, type SetData, type LiftCategory, type UpcomingCompetition } from '@/lib/powerlifting'
import { PhotosSeance } from '@/components/power/photos-seance'
import { ModelesSeance } from '@/components/power/modeles-seance'
import type { ModeleSeance } from '@/lib/modeles'
import { useTheme, useT, useLocale } from '@/app/ThemeContext'
import { joursProgrammes, nouvelleSerie, type LigneJour } from '@/lib/serie'
import { cleExercice, seriePrescrite, suggererProgression, type SeanceExercice } from '@/lib/progression'
import { proposerAnnulation } from '@/lib/annulation'
import { countryCodeToFlag } from '@/lib/countries'
import { Activity, Check, Coffee, Plus, Trash2, X, Copy, RefreshCw, Award, Sparkles, ChevronUp, ChevronDown, Dumbbell, Trophy, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/power/toaster'
import { RestTimer } from '@/components/power/rest-timer'

interface Props { dateActive: Date; isRestDayMode: boolean; setIsRestDayMode: (val: boolean) => void; pasDuJour: number | null; setDateActive: (date: Date) => void; nextCompetition: UpcomingCompetition | null; onGoToPalmares: (competitionId: string) => void; }
interface ExerciceRow { id: string | null; uid: string; name: string; coachTracking: SetData[]; tracking: SetData[]; comments: string; painLevel: number | null; }
interface WorkoutSetRow { id: string; date: string; exercise_name: string | null; coach_tracking_data: SetData[] | null; tracking_data: SetData[] | null; comments: string | null; fatigue_score: number | null; sleep_hours: number | null; steps_count: number | null; order_index: number | null; pain_level?: number | null; coach_reps?: number | string | null; coach_weight?: number | string | null; coach_rpe?: number | string | null; }
interface UserProgress { id: string; level: number; current_xp: number; total_xp: number; streak_days: number | null; last_completed_date: string | null; }
const REST_NAMES = ['Repos', 'Jour de Repos']
const videSet = (): SetData => ({ reps: '', weight: '', rpe: '' })
const creerExerciceVierge = (): ExerciceRow => ({ id: null, uid: crypto.randomUUID(), name: '', coachTracking: [videSet()], tracking: [videSet()], comments: '', painLevel: null, })
const safeInt = (v: string, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback }
const safeFloat = (v: string, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }
const formatDateAffichage = (dateStr: string, locale: string) => parseLocalDate(dateStr).toLocaleDateString(locale)
const valeurRemplie = (v: unknown) => String(v ?? '').trim() !== ''
// Rien de saisi (nom, séries, notes, douleur) : pas de ligne en base pour cet exercice.
const exerciceVide = (ex: ExerciceRow) => !valeurRemplie(ex.name) && !valeurRemplie(ex.comments) && ex.painLevel === null && [...ex.coachTracking, ...ex.tracking].every((s) => !valeurRemplie(s.reps) && !valeurRemplie(s.weight) && !valeurRemplie(s.rpe))
const abonnerReseau = (rappel: () => void) => { window.addEventListener('online', rappel); window.addEventListener('offline', rappel); return () => { window.removeEventListener('online', rappel); window.removeEventListener('offline', rappel) } }

export default function SessionForm({ dateActive, isRestDayMode, setIsRestDayMode, pasDuJour, setDateActive, nextCompetition, onGoToPalmares }: Props) {
  const [exercices, setExercices] = useState<ExerciceRow[]>([])
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [isSwappingDate, setIsSwappingDate] = useState(false)
  const [fatigue, setFatigue] = useState(5)
  const [sommeil, setSommeil] = useState(8)
  const [pas, setPas] = useState(0)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [savePending, setSavePending] = useState(false)
  const savePendingRef = useRef(false)
  const isOnline = useSyncExternalStore(abonnerReseau, () => navigator.onLine, () => true)
  const marquerPending = (v: boolean) => { savePendingRef.current = v; setSavePending(v) }
  const [isValidating, setIsValidating] = useState(false)
  const [isPropagating, setIsPropagating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const loadedDateRef = useRef<string | null>(null)
  const [chargements, setChargements] = useState(0)
  // Empreinte de la version chargée puis enregistrée : tant que la saisie ne bouge pas, rien n'est écrit.
  const empreinteEnregistreeRef = useRef<string | null>(null)
  // Lignes créées dont l'état n'a pas encore reçu l'identifiant : la sauvegarde suivante les met à jour au lieu de les recréer.
  const idsCreesRef = useRef(new Map<string, string>())
  const fileSauvegardeRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const painColumnOk = useRef(true)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [xpGained, setXpGained] = useState(0)
  const [newStreakState, setNewStreakState] = useState(0)
  const [leveledUp, setLeveledUp] = useState(false)
  const [tonnageSemainePrec, setTonnageSemainePrec] = useState<number | null>(null)
  const [historiqueExercices, setHistoriqueExercices] = useState<{ date: string; parExercice: Map<string, SeanceExercice> } | null>(null)

  const dateFormatee = toLocalDateStr(dateActive)
  const jourSemaine = dateActive.getDay()
  const { mode } = useTheme()
  const t = useT()
  const locale = useLocale()
  const estFitness = mode === 'fitness'
  // Une séance ne se valide que le jour même : pas de rattrapage des jours passés.
  const estAujourdhui = dateFormatee === toLocalDateStr(new Date())
  const suggestionsDuJour = useMemo(() => suggestionsExercices(mode, jourSemaine), [mode, jourSemaine])

  const pasDuJourRef = useRef(pasDuJour)
  useEffect(() => { pasDuJourRef.current = pasDuJour }, [pasDuJour])
  // Pas synchronisés arrivés après le chargement : ils remplacent la valeur affichée.
  const [pasRecus, setPasRecus] = useState(pasDuJour)
  if (pasDuJour !== pasRecus) { setPasRecus(pasDuJour); if (pasDuJour !== null) setPas(pasDuJour) }

  useEffect(() => { let cancelled = false; loadedDateRef.current = null; empreinteEnregistreeRef.current = null; idsCreesRef.current.clear(); const chargerSeance = async () => { const { data, error } = await supabase.from('workout_sets').select('*').eq('date', dateFormatee).order('order_index', { ascending: true }); if (cancelled) return; if (error) { toast(t('erreurChargement'), 'error'); return } const rows = (data ?? []) as WorkoutSetRow[]; if (rows.length > 0) { const isExplicitRest = rows.some((item) => REST_NAMES.includes(item.exercise_name ?? '')); const vraisExercices = rows.filter((item) => !REST_NAMES.includes(item.exercise_name ?? '')); if (isExplicitRest && vraisExercices.length === 0) setIsRestDayMode(true); else if (vraisExercices.length > 0) setIsRestDayMode(false); else setIsRestDayMode(jourSemaine === 0 || jourSemaine === 5); if (vraisExercices.length > 0) { setExercices(vraisExercices.map((item) => { const fallbackCoach: SetData[] = item.coach_reps ? [{ reps: String(item.coach_reps), weight: item.coach_weight != null ? String(item.coach_weight) : '', rpe: item.coach_rpe != null ? String(item.coach_rpe) : '' }] : [videSet()]; const coachTracking = item.coach_tracking_data ?? fallbackCoach; const tracking = [...(item.tracking_data ?? [videSet()])]; while (tracking.length < coachTracking.length) tracking.push(videSet()); return { id: item.id, uid: crypto.randomUUID(), name: item.exercise_name ?? '', coachTracking, tracking, comments: item.comments ?? '', painLevel: item.pain_level ?? null, } })) } else { setExercices([creerExerciceVierge()]) } const derniereLigne = rows[rows.length - 1]; setFatigue(derniereLigne.fatigue_score ?? 5); setSommeil(derniereLigne.sleep_hours ?? 8); setPas(pasDuJourRef.current ?? derniereLigne.steps_count ?? 0) } else { setIsRestDayMode(jourSemaine === 0 || jourSemaine === 5); setExercices([creerExerciceVierge()]); setFatigue(5); setSommeil(8); setPas(pasDuJourRef.current ?? 0) } loadedDateRef.current = dateFormatee; setChargements((n) => n + 1) }; chargerSeance(); return () => { cancelled = true } }, [dateFormatee, jourSemaine, setIsRestDayMode, t])
  useEffect(() => { let cancelled = false; const fetchSemainePrec = async () => { const d = parseLocalDate(dateFormatee); d.setDate(d.getDate() - 7); const { data } = await supabase.from('workout_sets').select('tracking_data').eq('date', toLocalDateStr(d)); if (cancelled) return; const total = (data ?? []).reduce((sum, row) => sum + setsTonnage(row.tracking_data as SetData[] | null), 0); setTonnageSemainePrec(total > 0 ? Math.round(total) : null) }; fetchSemainePrec(); return () => { cancelled = true } }, [dateFormatee])
  // Progression suggérée (muscu) : pour chaque exercice, la dernière séance des 60 jours précédents où il avait un plan.
  useEffect(() => {
    if (mode !== 'fitness') return
    let cancelled = false
    const [annee, mois, jour] = dateFormatee.split('-').map(Number)
    const depuis = toLocalDateStr(new Date(annee, mois - 1, jour - 60))
    supabase.from('workout_sets').select('exercise_name, coach_tracking_data, tracking_data').lt('date', dateFormatee).gte('date', depuis).order('date', { ascending: false }).limit(400).then(({ data }) => {
      if (cancelled) return
      const parExercice = new Map<string, SeanceExercice>()
      for (const ligne of (data ?? []) as Pick<WorkoutSetRow, 'exercise_name' | 'coach_tracking_data' | 'tracking_data'>[]) {
        const nom = ligne.exercise_name ?? ''
        const coach = ligne.coach_tracking_data ?? []
        if (!nom || REST_NAMES.includes(nom) || parExercice.has(cleExercice(nom)) || !coach.some(seriePrescrite)) continue
        parExercice.set(cleExercice(nom), { coach, fait: ligne.tracking_data ?? [] })
      }
      setHistoriqueExercices({ date: dateFormatee, parExercice })
    })
    return () => { cancelled = true }
  }, [dateFormatee, mode])
  const handleToggleMode = () => { if (!isRestDayMode && exercices.length > 0 && exercices[0].name !== '') { if (!confirm(t('effacerPourRepos'))) return } setIsRestDayMode(!isRestDayMode) }
  const ecrireSeance = async (dateStr: string): Promise<boolean> => { if (typeof navigator !== 'undefined' && !navigator.onLine) return false; if (isRestDayMode) { const payload = { date: dateStr, exercise_name: 'Jour de Repos', fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas }; const del = await supabase.from('workout_sets').delete().eq('date', dateStr).neq('exercise_name', 'Jour de Repos'); if (del.error) return false; const { data, error: selError } = await supabase.from('workout_sets').select('id').eq('date', dateStr).limit(1); if (selError) return false; if (data && data.length > 0) { const { error } = await supabase.from('workout_sets').update(payload).eq('id', data[0].id); return !error } const { error } = await supabase.from('workout_sets').insert([payload]); return !error } const delRest = await supabase.from('workout_sets').delete().eq('date', dateStr).in('exercise_name', REST_NAMES); if (delRest.error) return false; const snapshot = exercices.filter((ex) => ex.id || idsCreesRef.current.has(ex.uid) || !exerciceVide(ex)); type SaveResult = { data: { id: string } | null; error: { message: string } | null }; const sauver = async (includePain: boolean): Promise<SaveResult[]> => { const buildPayload = (ex: ExerciceRow, index: number) => { const payload: Record<string, unknown> = { date: dateStr, exercise_name: ex.name || t('exerciceSansNom'), coach_tracking_data: ex.coachTracking, tracking_data: ex.tracking, comments: ex.comments || null, fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas, order_index: index, }; if (includePain) payload.pain_level = ex.painLevel; return payload }; return Promise.all(snapshot.map(async (ex, index): Promise<SaveResult> => { const id = ex.id ?? idsCreesRef.current.get(ex.uid); if (id) { const { error } = await supabase.from('workout_sets').update(buildPayload(ex, index)).eq('id', id); return { data: null, error } } const { data, error } = await supabase.from('workout_sets').insert([buildPayload(ex, index)]).select('id').single(); return { data: data as { id: string } | null, error } })) }; let results = await sauver(painColumnOk.current); if (painColumnOk.current && results.some((r) => r.error?.message?.includes('pain_level'))) { painColumnOk.current = false; results = await sauver(false) } const idByUid = new Map<string, string>(); snapshot.forEach((ex, i) => { const r = results[i]; if (!ex.id && r?.data?.id) { idByUid.set(ex.uid, r.data.id); idsCreesRef.current.set(ex.uid, r.data.id) } }); if (idByUid.size > 0) { setExercices((prev) => prev.map((ex) => { const newId = idByUid.get(ex.uid); return newId ? { ...ex, id: newId } : ex })) } return results.every((r) => !r.error) }
  // Une écriture à la fois : sur un réseau lent, deux sauvegardes simultanées créaient l'exercice en double.
  const executerSauvegarde = (dateStr: string): Promise<boolean> => { const tache = fileSauvegardeRef.current.then(() => ecrireSeance(dateStr)).catch(() => false); fileSauvegardeRef.current = tache; return tache }
  const sauvegardeRef = useRef(executerSauvegarde); useEffect(() => { sauvegardeRef.current = executerSauvegarde })
  // Pas synchronisés (ou à zéro) exclus : à eux seuls, ils ne justifient pas d'écrire une séance.
  const empreinte = useMemo(() => JSON.stringify([isRestDayMode, fatigue, sommeil, pas === 0 || pas === pasDuJour ? null : pas, exercices.map(({ name, coachTracking, tracking, comments, painLevel }) => [name, coachTracking, tracking, comments, painLevel])]), [isRestDayMode, fatigue, sommeil, pas, pasDuJour, exercices])
  useEffect(() => { if (chargements === 0 || loadedDateRef.current !== dateFormatee) return; if (empreinteEnregistreeRef.current === null) { empreinteEnregistreeRef.current = empreinte; return } if (empreinte === empreinteEnregistreeRef.current) return; const timeoutId = setTimeout(async () => { const ok = await sauvegardeRef.current(dateFormatee); if (ok) { empreinteEnregistreeRef.current = empreinte; setLastSaved(new Date()); if (savePendingRef.current) marquerPending(false) } else { marquerPending(true) } }, 1500); return () => clearTimeout(timeoutId) }, [empreinte, dateFormatee, chargements])
  useEffect(() => { const onOnline = async () => { if (!savePendingRef.current || loadedDateRef.current === null) return; const ok = await sauvegardeRef.current(loadedDateRef.current); if (ok) { marquerPending(false); setLastSaved(new Date()); toast(t('synchronise'), 'success') } }; window.addEventListener('online', onOnline); return () => window.removeEventListener('online', onOnline) }, [t])
  const handleAIGeneration = async () => { if (!aiPrompt.trim()) return; let aiConsent = false; try { aiConsent = localStorage.getItem('powerapp_ai_consent') === '1' } catch { } if (!aiConsent) { const ok = confirm(t('autoriserIA')); if (!ok) return; try { localStorage.setItem('powerapp_ai_consent', '1') } catch { } } setIsGenerating(true); try { const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ai-consent': '1' }, body: JSON.stringify({ prompt: aiPrompt }), }); if (!res.ok) throw new Error('Erreur API'); const aiData = (await res.json()) as { name: string; comments: string; coachTracking: SetData[] }[]; const newExercices: ExerciceRow[] = aiData.map((ex) => { const coachTracking = ex.coachTracking?.length ? ex.coachTracking : [videSet()]; return { id: null, uid: crypto.randomUUID(), name: ex.name, comments: ex.comments || '', coachTracking, tracking: coachTracking.map(() => videSet()), painLevel: null, } }); setExercices((prev) => prev.length === 1 && prev[0].name === '' ? newExercices : [...prev, ...newExercices]); setAiPrompt('') } catch (e) { toast(t('erreurIA'), 'error') } finally { setIsGenerating(false) } }
  const validerMission = async () => { if (dateFormatee !== toLocalDateStr(new Date())) { toast(t('validationJourMeme'), 'info'); return } setIsValidating(true); const savedOk = await executerSauvegarde(dateFormatee); if (!savedOk) { marquerPending(true); toast(t('sauvegardeImpossible'), 'error'); setIsValidating(false); return } try { const { data } = await supabase.from('user_progress').select('*').limit(1).single(); const progress = data as UserProgress | null; if (!progress) throw new Error('Profil introuvable'); if (progress.last_completed_date === dateFormatee) { toast(t('dejaValide'), 'info'); return } const { error: erreurValidation } = await supabase.from('validations_seance').insert({ date: dateFormatee, type: isRestDayMode ? 'repos' : 'seance' }); /* Journal absent (migration pas encore lancée) : on valide quand même, la règle du jour même est déjà vérifiée plus haut. */ const journalAbsent = erreurValidation?.code === 'PGRST205'; if (erreurValidation && !journalAbsent) { const attendue = erreurValidation.code === '23505' || erreurValidation.code === '42501'; toast(erreurValidation.code === '23505' ? t('dejaValide') : erreurValidation.code === '42501' ? t('validationJourMeme') : t('erreur'), attendue ? 'info' : 'error'); return } let programmes = new Set<string>(); if (progress.last_completed_date && progress.last_completed_date < dateFormatee) { const { data: lignesEcart } = await supabase.from('workout_sets').select('date, exercise_name, tracking_data, coach_tracking_data').gt('date', progress.last_completed_date).lt('date', dateFormatee); programmes = joursProgrammes((lignesEcart ?? []) as LigneJour[]) } const newStreak = nouvelleSerie(progress.streak_days ?? 0, progress.last_completed_date, dateFormatee, programmes); let baseXP = 0; if (isRestDayMode) { baseXP = 50 } else { baseXP += 50; if (pas >= 8000) baseXP += 25; if (sommeil >= 7.5) baseXP += 25; const hasMainLifts = exercices.some((ex) => classifyLift(ex.name, mode) !== null); if (hasMainLifts) baseXP += 50; const listeAccessoires = mode === 'fitness' ? FIT_ACCESSOIRES : ACCESSORIES; const hasAccessories = exercices.some((ex) => listeAccessoires.includes(ex.name)); if (hasAccessories) baseXP += 50 } let multiplier = 1; if (newStreak >= 7) multiplier = 1.5; else if (newStreak >= 5) multiplier = 1.25; else if (newStreak >= 3) multiplier = 1.1; const finalXP = Math.round(baseXP * multiplier); let newLevel = progress.level; let newCurrentXP = progress.current_xp + finalXP; const newTotalXP = progress.total_xp + finalXP; let xpNeeded = newLevel * 1000; let aLevelUp = false; while (newCurrentXP >= xpNeeded) { newCurrentXP -= xpNeeded; newLevel += 1; xpNeeded = newLevel * 1000; aLevelUp = true } const { error: erreurXp } = await supabase.from('user_progress').update({ level: newLevel, current_xp: newCurrentXP, total_xp: newTotalXP, streak_days: newStreak, last_completed_date: dateFormatee, }).eq('id', progress.id); if (erreurXp) throw erreurXp; window.dispatchEvent(new Event('user-progress-updated')); setXpGained(finalXP); setNewStreakState(newStreak); setLeveledUp(aLevelUp); setShowModal(true) } catch (e) { toast(t('erreur'), 'error') } finally { setIsValidating(false) } }
  const propagerSemaine1VersBloc = async () => { if (!confirm(t('propager'))) return; setIsPropagating(true); try { const savedOk = await executerSauvegarde(dateFormatee); if (!savedOk) throw new Error('Sauvegarde impossible'); const { data: semaine1Data, error: fetchError } = await supabase.from('workout_sets').select('*').eq('date', dateFormatee); if (fetchError) throw fetchError; if (!semaine1Data || semaine1Data.length === 0) throw new Error('Vide'); const datesCibles = [7, 14, 21, 28].map((delta) => { const d = parseLocalDate(dateFormatee); d.setDate(d.getDate() + delta); return toLocalDateStr(d) }); const insertions = datesCibles.flatMap((dateCibleStr) => (semaine1Data as (WorkoutSetRow & { created_at?: string })[]).map(({ id: _id, created_at: _creeLe, ...dataToCopy }) => ({ ...dataToCopy, date: dateCibleStr }))); const { error: erreurEffacement } = await supabase.from('workout_sets').delete().in('date', datesCibles); if (erreurEffacement) throw erreurEffacement; const { error: insertError } = await supabase.from('workout_sets').insert(insertions); if (insertError) throw insertError; toast(t('propage'), 'success') } catch (e) { toast(t('erreur'), 'error') } finally { setIsPropagating(false) } }
  const reinitialiserFutur = async () => {
    if (!confirm(t('effacerFutur'))) return
    setIsResetting(true)
    try {
      const demain = new Date(dateActive)
      demain.setDate(demain.getDate() + 1)
      const depuis = toLocalDateStr(demain)
      // Copie complète avant effacement : c'est elle qu'on réinsère en cas d'annulation.
      const { data: copie, error: erreurCopie } = await supabase.from('workout_sets').select('*').gte('date', depuis)
      if (erreurCopie) throw erreurCopie
      const { error } = await supabase.from('workout_sets').delete().gte('date', depuis)
      if (error) throw error
      proposerAnnulation({
        message: t('futurEfface'),
        libelleBouton: t('annuler'),
        annuler: async () => {
          if (!copie || copie.length === 0) return true
          const { error: erreurRestauration } = await supabase.from('workout_sets').insert(copie)
          if (erreurRestauration) {
            toast(t('restaurationImpossible'), 'error')
            return false
          }
          toast(t('restaure'), 'success')
          return true
        },
      })
    } catch (e) {
      toast(t('erreur'), 'error')
    } finally {
      setIsResetting(false)
    }
  }

  const handleSwapDate = async (newDateStr: string) => {
    if (newDateStr === dateFormatee || isSwappingDate) return
    setIsSwappingDate(true)
    try {
      const savedOk = await executerSauvegarde(dateFormatee)
      if (!savedOk) { toast(t('sauvegardeImpossibleAvantDate'), 'error'); return }

      const { data: rowsB, error: fetchBError } = await supabase.from('workout_sets').select('id').eq('date', newDateStr)
      if (fetchBError) throw fetchBError

      if (rowsB && rowsB.length > 0) {
        const { data: rowsA, error: fetchAError } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee)
        if (fetchAError) throw fetchAError
        const idsA = (rowsA ?? []).map((r) => r.id)
        const idsB = rowsB.map((r) => r.id)

        if (idsA.length > 0) {
          const { error } = await supabase.from('workout_sets').update({ date: newDateStr }).in('id', idsA)
          if (error) throw error
        }
        const { error: errB } = await supabase.from('workout_sets').update({ date: dateFormatee }).in('id', idsB)
        if (errB) throw errB
        toast(t('seancesInterverties', { date: formatDateAffichage(newDateStr, locale) }), 'success')
      } else {
        const { error } = await supabase.from('workout_sets').update({ date: newDateStr }).eq('date', dateFormatee)
        if (error) throw error
        toast(t('seanceDeplacee', { date: formatDateAffichage(newDateStr, locale) }), 'success')
      }

      setDateActive(parseLocalDate(newDateStr))
    } catch (e) {
      toast(t('erreurChangementDate'), 'error')
    } finally {
      setIsSwappingDate(false)
    }
  }

  const ajouterExercice = useCallback(() => { setExercices((prev) => [...prev, creerExerciceVierge()]) }, [])
  const chargerModele = useCallback(async (modele: ModeleSeance) => {
    const nouveaux: ExerciceRow[] = modele.exercices.map((ex) => ({ id: null, uid: crypto.randomUUID(), name: ex.nom, coachTracking: ex.prescription.map((s) => ({ ...s })), tracking: ex.prescription.map(() => videSet()), comments: ex.notes, painLevel: null }))
    // Comme pour l'IA : l'exercice vierge du jour est remplacé, sinon on ajoute à la suite.
    // La sauvegarde automatique a pu déjà l'enregistrer : sa ligne est effacée d'abord.
    const vierge = exercices.length === 1 && exercices[0].name === '' ? exercices[0] : null
    const idVierge = vierge ? vierge.id ?? idsCreesRef.current.get(vierge.uid) : undefined
    if (idVierge) await supabase.from('workout_sets').delete().eq('id', idVierge)
    setExercices((prev) => (prev.length === 1 && prev[0].name === '' ? nouveaux : [...prev, ...nouveaux]))
    toast(t('modeleCharge', { nom: modele.nom }), 'success')
  }, [exercices, t])
  const supprimerExercice = useCallback(async (index: number, ex: ExerciceRow) => {
    const id = ex.id ?? idsCreesRef.current.get(ex.uid)
    if (id) {
      const { error } = await supabase.from('workout_sets').delete().eq('id', id)
      if (error) { toast(t('erreur'), 'error'); return }
    }
    idsCreesRef.current.delete(ex.uid)
    setExercices((prev) => prev.filter((e) => e.uid !== ex.uid))
    const dateSuppression = dateFormatee
    proposerAnnulation({
      message: t('exerciceSupprime'),
      libelleBouton: t('annuler'),
      annuler: () => {
        // Entre-temps on a pu changer de jour : on ne glisse pas l'exercice
        // dans la séance d'une autre date.
        if (loadedDateRef.current !== dateSuppression) {
          toast(t('restaurationImpossible'), 'error')
          return false
        }
        // La ligne a été effacée en base : on la remet SANS identifiant, sinon
        // la sauvegarde automatique mettrait à jour une ligne qui n'existe plus.
        setExercices((prev) => {
          const suite = [...prev]
          suite.splice(Math.min(index, suite.length), 0, { ...ex, id: null })
          return suite
        })
        return true
      },
    })
  }, [t, dateFormatee])
  const deplacerExercice = useCallback((index: number, direction: 'up' | 'down') => { setExercices((prev) => { const newIndex = direction === 'up' ? index - 1 : index + 1; if (newIndex < 0 || newIndex >= prev.length) return prev; const liste = [...prev]; [liste[index], liste[newIndex]] = [liste[newIndex], liste[index]]; return liste }) }, [])
  const patchExercice = useCallback((index: number, patch: Partial<ExerciceRow>) => { setExercices((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex))) }, [])
  const updateSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => {
    setExercices((prev) => {
      const newExercices = [...prev];
      const ex = { ...newExercices[exIndex] };
      const newList = [...ex[list]];
      newList[setIndex] = { ...newList[setIndex], [champ]: valeur };
      ex[list] = newList;
      
      if (mode !== 'fitness' && list === 'tracking' && champ === 'rpe' && valeur !== '') {
        const actualRpe = parseFloat(valeur);
        const coachRpe = parseFloat(ex.coachTracking[setIndex]?.rpe || '0');
        
        if (!isNaN(actualRpe) && !isNaN(coachRpe) && coachRpe > 0 && actualRpe > coachRpe) {
          const rpeDiff = actualRpe - coachRpe;
          const dropPercentage = rpeDiff * 0.05;
          let didDrop = false;

          for (let i = setIndex + 1; i < ex.tracking.length; i++) {
            const currentWeightStr = ex.tracking[i].weight || ex.coachTracking[i]?.weight;
            if (currentWeightStr) {
              const currentWeight = parseFloat(currentWeightStr);
              if (!isNaN(currentWeight) && currentWeight > 0) {
                const rawNewWeight = currentWeight * (1 - dropPercentage);
                const newWeight = Math.round(rawNewWeight / 2.5) * 2.5;
                if (newWeight < currentWeight) {
                  ex.tracking[i] = { ...ex.tracking[i], weight: String(newWeight) };
                  didDrop = true;
                }
              }
            }
          }
          if (didDrop) {
            toast(t('fatigueDetectee', { actuel: actualRpe, prevu: coachRpe }), 'info');
          }
        }
      }
      
      newExercices[exIndex] = ex;
      return newExercices;
    });
  }, [mode, t])
  const ajouterSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking') => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; if (list === 'coachTracking') return { ...ex, coachTracking: [...ex.coachTracking, videSet()], tracking: [...ex.tracking, videSet()] }; return { ...ex, tracking: [...ex.tracking, videSet()] } })) }, [])
  const supprimerSerie = useCallback((exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; if (list === 'coachTracking') { const coachTracking = ex.coachTracking.filter((_, j) => j !== setIndex); const tracking = ex.tracking.length > coachTracking.length ? ex.tracking.filter((_, j) => j !== setIndex) : ex.tracking; return { ...ex, coachTracking, tracking } } return { ...ex, tracking: ex.tracking.filter((_, j) => j !== setIndex) } })) }, [])
  const copierCoach = useCallback((exIndex: number) => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; const tracking: SetData[] = ex.coachTracking.map((cSet, j) => ({ reps: cSet.reps, weight: cSet.weight, rpe: ex.tracking[j]?.rpe ?? '', })); if (ex.tracking.length > ex.coachTracking.length) { tracking.push(...ex.tracking.slice(ex.coachTracking.length)) } return { ...ex, tracking } })) }, [])
  const appliquerSuggestion = useCallback((exIndex: number, poids: number, ancien: number) => { setExercices((prev) => prev.map((ex, i) => i !== exIndex ? ex : { ...ex, coachTracking: ex.coachTracking.map((s) => (parseFloat(s.weight) === ancien || (s.weight.trim() === '' && s.reps.trim() !== '') ? { ...s, weight: String(poids) } : s)) })) }, [])
  const validerSerieCoach = useCallback((exIndex: number, setIndex: number) => { setExercices((prev) => prev.map((ex, i) => { if (i !== exIndex) return ex; const coach = ex.coachTracking[setIndex]; if (!coach) return ex; const tracking = ex.tracking.map((s, j) => j === setIndex ? { ...s, reps: coach.reps, weight: coach.weight } : s); return { ...ex, tracking } })); if (typeof navigator !== 'undefined') navigator.vibrate?.(50) }, [])

  const e1rmBaseline = useRef<Record<LiftCategory, number> | null>(null)
  useEffect(() => { let cancelled = false; const chargerBaseline = async () => { const since = new Date(); since.setMonth(since.getMonth() - 6); const { data, error } = await supabase.from('workout_sets').select('exercise_name, tracking_data').gte('date', toLocalDateStr(since)).not('tracking_data', 'is', null); if (cancelled || error) return; const maxes: Record<LiftCategory, number> = { squat: 0, bench: 0, deadlift: 0 }; for (const row of (data ?? []) as { exercise_name: string | null; tracking_data: SetData[] | null }[]) { const cat = classifyLift(row.exercise_name, mode); if (!cat) continue; const best = bestE1RM(row.tracking_data); if (best > maxes[cat]) maxes[cat] = best } e1rmBaseline.current = maxes }; chargerBaseline(); return () => { cancelled = true } }, [mode])
  useEffect(() => { if (isRestDayMode) return; const timeoutId = setTimeout(() => { const baseline = e1rmBaseline.current; if (!baseline) return; for (const ex of exercices) { const cat = classifyLift(ex.name, mode); if (!cat) continue; const e1rm = bestE1RM(ex.tracking); if (e1rm <= baseline[cat]) continue; const ancien = Math.round(baseline[cat]); baseline[cat] = e1rm; if (ancien > 0) { toast(t('prEstime', { nom: ex.name, kg: Math.round(e1rm) }), 'pr'); if (typeof navigator !== 'undefined') navigator.vibrate?.([80, 60, 80]) } } }, 1200); return () => clearTimeout(timeoutId) }, [exercices, isRestDayMode, mode, t])

  const suggestions = useMemo(() => {
    const parExercice = historiqueExercices?.date === dateFormatee ? historiqueExercices.parExercice : null
    return exercices.map((ex) => (parExercice && ex.name.trim() ? suggererProgression(parExercice.get(cleExercice(ex.name)), ex.coachTracking) : null))
  }, [exercices, historiqueExercices, dateFormatee])
  const tonnageJour = useMemo(() => sessionTonnage(exercices), [exercices])
  const deltaTonnage = tonnageSemainePrec ? Math.round(((tonnageJour - tonnageSemainePrec) / tonnageSemainePrec) * 100) : null
  const listId = `liste-exos-${jourSemaine}`

  if (nextCompetition && nextCompetition.date === dateFormatee) {
    const drapeau = countryCodeToFlag(nextCompetition.country_code)
    return (
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 sm:p-16 text-center animate-in fade-in duration-500">
        <Trophy className="size-12 text-foreground" />
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground uppercase tracking-widest">Comp Day</h2>
          <p className="mt-3 text-sm font-bold text-muted-foreground uppercase tracking-widest">{nextCompetition.name}</p>
          {(nextCompetition.level || drapeau) && (
            <div className="mt-3 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {nextCompetition.level && <span>{nextCompetition.level}</span>}
              {drapeau && <span className="text-base leading-none tracking-normal">{drapeau}</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => onGoToPalmares(nextCompetition.id)}
          className="rounded-xl bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:opacity-90"
        >
          Saisir mes résultats
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-card p-6 rounded-2xl border border-border gap-6">
        <div>
          {isEditingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={dateFormatee}
              onChange={(e) => { const v = e.target.value; setIsEditingDate(false); if (v) handleSwapDate(v) }}
              onBlur={() => setIsEditingDate(false)}
              className="bg-input border border-border rounded-lg px-3 py-2 font-mono text-lg font-black text-foreground outline-none focus:ring-2 focus:ring-ring tabular-nums [color-scheme:dark]"
            />
          ) : (
            <h2
              onDoubleClick={() => !isSwappingDate && setIsEditingDate(true)}
              title={t('doubleCliquerDeplacer')}
              className="text-xl font-black text-foreground uppercase tracking-widest flex items-center gap-3 cursor-pointer select-none"
            >
              {isRestDayMode ? <Coffee className="size-5" /> : <Activity className="size-5" />}
              {isRestDayMode ? t('recuperation') : t('seanceDu', { date: dateActive.toLocaleDateString(locale) })}
              {isSwappingDate && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-4 bg-secondary p-1 rounded-xl w-full sm:w-auto justify-center">
          <button onClick={handleToggleMode} className={cn("px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", !isRestDayMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
            {t('onglletSeance')}
          </button>
          <button onClick={handleToggleMode} className={cn("px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all", isRestDayMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
            {t('ongletRepos')}
          </button>
        </div>
      </div>

      {isRestDayMode ? (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-8 rounded-2xl border border-border bg-card flex flex-col items-center text-center space-y-4">
            <Coffee className="size-8 text-foreground mb-2" />
            <h2 className="text-2xl font-black uppercase tracking-widest text-foreground">{t('reposActif')}</h2>
          </div>

          <DailyMetrics fatigue={fatigue} sommeil={sommeil} pas={pas} setFatigue={setFatigue} setSommeil={setSommeil} setPas={setPas} />

          <PhotosSeance date={dateFormatee} />

          <button onClick={validerMission} disabled={isValidating || !estAujourdhui} className="w-full p-6 rounded-full font-black text-sm uppercase tracking-widest bg-primary hover:opacity-90 text-primary-foreground transition-all flex justify-center items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed">
            {isValidating ? <RefreshCw className="size-5 animate-spin" /> : <><Award className="size-5" /> {t('validerRepos')}</>}
          </button>
          {!estAujourdhui && <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('validationJourMeme')}</p>}
        </div>
      ) : (

      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col sm:flex-row gap-3 p-2 bg-card border border-border rounded-2xl">
          <div className="flex-1 flex items-center gap-3 bg-secondary px-4 py-3 rounded-xl">
            <Sparkles className="size-4 text-foreground shrink-0" />
            <input type="text" maxLength={1000} placeholder={t('exempleIA')} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAIGeneration() }} className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-[10px] uppercase font-bold tracking-widest" disabled={isGenerating} />
          </div>
          <button onClick={handleAIGeneration} disabled={isGenerating || !aiPrompt.trim()} className="px-8 py-3 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[10px] uppercase tracking-widest font-black rounded-xl transition-colors">
            {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : t('generer')}
          </button>
        </div>

        <ModelesSeance exercices={exercices} onCharger={chargerModele} />

        <datalist id={listId}>{suggestionsDuJour.map((nomExo) => <option key={nomExo} value={nomExo} />)}</datalist>

        {exercices.map((ex, exIndex) => (
          <ExerciseCard key={ex.uid} ex={ex} exIndex={exIndex} isLast={exIndex === exercices.length - 1} listId={listId} onPatch={patchExercice} onUpdateSerie={updateSerie} onAjouterSerie={ajouterSerie} onSupprimerSerie={supprimerSerie} onDeplacer={deplacerExercice} onSupprimer={supprimerExercice} onCopierCoach={copierCoach} onValiderSerie={validerSerieCoach} suggestionPoids={suggestions[exIndex]?.poids ?? null} suggestionAncien={suggestions[exIndex]?.ancien ?? null} onAppliquerSuggestion={appliquerSuggestion} />
        ))}

        <button onClick={ajouterExercice} className="w-full py-6 border border-border hover:border-ring hover:bg-card text-muted-foreground hover:text-foreground rounded-2xl flex items-center justify-center gap-2 transition-colors text-[10px] font-bold uppercase tracking-widest">
          <Plus className="size-4" /> {t('ajouterExercice')}
        </button>

        <DailyMetrics fatigue={fatigue} sommeil={sommeil} pas={pas} setFatigue={setFatigue} setSommeil={setSommeil} setPas={setPas} />

        <PhotosSeance date={dateFormatee} />

        <div className="p-6 rounded-2xl border border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Dumbbell className="size-4 text-foreground" /> {t('tonnage')}
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black tabular-nums text-foreground">{tonnageJour.toLocaleString(locale)}</span>
            {deltaTonnage !== null && tonnageJour > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground">
                {deltaTonnage >= 0 ? '+' : ''}{deltaTonnage}% VS S-1
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="h-4 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {savePending ? <span className="text-foreground">{t('attenteSync')}</span> : lastSaved && t('securiseA', { heure: lastSaved.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={propagerSemaine1VersBloc} disabled={isPropagating} className="py-4 bg-card hover:bg-accent text-foreground rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border border-border transition-colors">
              <Copy className="size-4" /> {t('propagerBloc')}
            </button>
            <button onClick={reinitialiserFutur} disabled={isResetting} className="py-4 bg-card hover:bg-accent text-destructive rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border border-border transition-colors">
              <Trash2 className="size-4" /> {t('resetFutur')}
            </button>
          </div>

          <button onClick={validerMission} disabled={isValidating || !estAujourdhui} className="w-full p-6 rounded-full font-black text-sm uppercase tracking-widest bg-primary hover:opacity-90 text-primary-foreground transition-all flex justify-center items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed">
            {isValidating ? <RefreshCw className="size-5 animate-spin" /> : <><Award className="size-5" /> {t('terminerSeance')}</>}
          </button>
          {!estAujourdhui && <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('validationJourMeme')}</p>}
        </div>
      </div>
      )}

      {estFitness && !isRestDayMode && (
        <>
          {/* Réserve la hauteur de la barre de repos, fixée en bas d'écran :
              sans ça elle masquerait le bouton de fin de séance. */}
          <div aria-hidden className="h-20" />
          <RestTimer />
        </>
      )}

      {(!isOnline || savePending) && (
        <div className={cn("fixed left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full border border-border bg-background text-foreground text-[10px] font-bold uppercase tracking-widest shadow-xl whitespace-nowrap", estFitness && !isRestDayMode ? 'bottom-24' : 'bottom-4')}>
          {t('horsLigne')}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full space-y-8 shadow-2xl">
            <div className="text-center space-y-4">
              <Award className="size-12 mx-auto text-foreground" />
              <h2 className="text-3xl font-black text-foreground tracking-widest">{t('missionAccomplie')}</h2>
            </div>
            <div className="bg-secondary rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('xpGagne')}</span><span className="text-xl font-black text-foreground tabular-nums">+{xpGained}</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('serieStreak')}</span><span className="text-lg font-black text-foreground tabular-nums">{newStreakState} {t('jourCourt')}</span></div>
            </div>
            {leveledUp && (<div className="text-foreground text-center font-black uppercase tracking-widest">{t('levelUp')}</div>)}
            <button onClick={() => setShowModal(false)} className="w-full py-4 bg-primary hover:opacity-90 text-primary-foreground rounded-full font-black text-xs uppercase tracking-widest transition-colors">{t('fermer')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DailyMetrics({ fatigue, sommeil, pas, setFatigue, setSommeil, setPas }: { fatigue: number; sommeil: number; pas: number; setFatigue: (v: number) => void; setSommeil: (v: number) => void; setPas: (v: number) => void; }) {
  const t = useT()
  return (
    <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">{t('fatigue')}</span>
          <div className="flex items-center gap-4 bg-secondary p-4 rounded-xl border border-border">
            <input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(safeInt(e.target.value, 5))} className="w-full accent-primary" />
            <span className="text-xl font-black text-foreground tabular-nums">{fatigue}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">{t('sommeil')}</span>
          <div className="bg-secondary p-4 rounded-xl border border-border">
            <input type="number" step="0.5" inputMode="decimal" value={sommeil} onChange={(e) => setSommeil(safeFloat(e.target.value))} className="w-full bg-transparent text-xl font-black tabular-nums text-foreground outline-none" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">{t('pas')}</span>
          <div className="bg-secondary p-4 rounded-xl border border-border">
            <input type="number" inputMode="decimal" value={pas} onChange={(e) => setPas(safeInt(e.target.value))} className="w-full bg-transparent text-xl font-black tabular-nums text-foreground outline-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ExerciseCardProps { ex: ExerciceRow; exIndex: number; isLast: boolean; listId: string; onPatch: (index: number, patch: Partial<ExerciceRow>) => void; onUpdateSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => void; onAjouterSerie: (exIndex: number, list: 'coachTracking' | 'tracking') => void; onSupprimerSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => void; onDeplacer: (index: number, direction: 'up' | 'down') => void; onSupprimer: (index: number, ex: ExerciceRow) => void; onCopierCoach: (exIndex: number) => void; onValiderSerie: (exIndex: number, setIndex: number) => void; suggestionPoids: number | null; suggestionAncien: number | null; onAppliquerSuggestion: (exIndex: number, poids: number, ancien: number) => void; }

const ExerciseCard = memo(function ExerciseCard({ ex, exIndex, isLast, listId, onPatch, onUpdateSerie, onAjouterSerie, onSupprimerSerie, onDeplacer, onSupprimer, onCopierCoach, onValiderSerie, suggestionPoids, suggestionAncien, onAppliquerSuggestion }: ExerciseCardProps) {
  const { mode } = useTheme()
  const t = useT()
  const locale = useLocale()
  // Pas de RPE en mode fitness : c'est un outil d'autorégulation de
  // powerlifteur, hors sujet pour de la muscu en salle sans compétition.
  const avecRpe = mode !== 'fitness'
  const e1rmJour = classifyLift(ex.name, mode) ? bestE1RM(ex.tracking) : 0
  return (
    <div className="p-4 sm:p-6 rounded-2xl border border-border bg-card space-y-6">
      <div className="flex items-center gap-1.5 sm:gap-3 w-full max-w-full">
        <div className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-lg font-black tabular-nums">{exIndex + 1}</div>
        <input list={listId} placeholder={t('nomDuMouvement')} className="flex-1 min-w-0 p-3 bg-input border border-border rounded-xl text-foreground text-sm font-black uppercase tracking-widest outline-none focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground transition-colors truncate" value={ex.name} onChange={(e) => onPatch(exIndex, { name: e.target.value })} />

        <div className="shrink-0 flex items-center bg-secondary border border-border rounded-xl">
          <button onClick={() => onDeplacer(exIndex, 'up')} disabled={exIndex === 0} className="p-3 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors border-r border-border"><ChevronUp className="size-4" /></button>
          <button onClick={() => onDeplacer(exIndex, 'down')} disabled={isLast} className="p-3 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"><ChevronDown className="size-4" /></button>
        </div>
        <button onClick={() => onSupprimer(exIndex, ex)} className="shrink-0 p-3 text-muted-foreground hover:text-destructive bg-secondary border border-border rounded-xl transition-colors"><Trash2 className="size-4" /></button>
      </div>

      {suggestionPoids !== null && suggestionAncien !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-3 py-2">
          <TrendingUp className="size-4 shrink-0 text-foreground" />
          <p className="min-w-0 flex-1 text-xs font-bold text-foreground">{t('suggestionProgression', { ancien: suggestionAncien.toLocaleString(locale), poids: suggestionPoids.toLocaleString(locale) })}</p>
          <button onClick={() => onAppliquerSuggestion(exIndex, suggestionPoids, suggestionAncien)} className="h-9 shrink-0 rounded-lg bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90">{t('appliquer')}</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-background flex flex-col h-full">
          <h3 className="text-[10px] font-bold text-muted-foreground mb-4 uppercase tracking-widest">{t('prescription')}</h3>
          <div className={cn('grid gap-2 mb-2 px-1', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto]' : 'grid-cols-[auto_1fr_1fr_auto]')}>
            <div className="w-6"></div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('reps')}</div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('poids')}</div>{avecRpe && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('rpe')}</div>}<div className="w-9"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.coachTracking.map((set, setIndex) => (
              <div key={setIndex} className={cn('grid gap-2 items-center', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto]' : 'grid-cols-[auto_1fr_1fr_auto]')}>
                <span className="w-6 text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">S{setIndex + 1}</span>
                <input type="text" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'reps', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums" />
                <input type="text" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'weight', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums" />
                {avecRpe && <input type="text" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'rpe', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums" />}
                <button onClick={() => onSupprimerSerie(exIndex, 'coachTracking', setIndex)} className="h-11 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => onAjouterSerie(exIndex, 'coachTracking')} className="mt-4 w-full py-3 bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">{t('ajouter')}</button>
        </div>

        <div className="p-4 rounded-xl border border-border bg-background flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-widest">{t('valide')}</h3>
            {e1rmJour > 0 && <span className="text-[10px] font-black text-foreground tabular-nums tracking-widest">E1RM: {Math.round(e1rmJour)}</span>}
          </div>
          <div className={cn('grid gap-1.5 mb-2 px-1', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto_auto]' : 'grid-cols-[auto_1fr_1fr_auto_auto]')}>
            <div className="w-5"></div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('reps')}</div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('poids')}</div>{avecRpe && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('rpe')}</div>}<div className="w-9"></div><div className="w-9"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.tracking.map((set, setIndex) => {
              const coach = ex.coachTracking[setIndex]; const coachRemplie = !!coach && (coach.reps !== '' || coach.weight !== ''); const serieFaite = coachRemplie && set.reps === coach.reps && set.weight === coach.weight
              return (
                <div key={setIndex} className={cn('grid gap-1.5 items-center', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto_auto]' : 'grid-cols-[auto_1fr_1fr_auto_auto]')}>
                  <span className="w-5 text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">S{setIndex + 1}</span>
                  <input type="text" inputMode="decimal" enterKeyHint="next" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'reps', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums focus:ring-1 focus:ring-ring" />
                  <input type="text" inputMode="decimal" enterKeyHint="next" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'weight', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums focus:ring-1 focus:ring-ring" />
                  {avecRpe && <input type="text" inputMode="decimal" enterKeyHint="done" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'rpe', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums focus:ring-1 focus:ring-ring" />}
                  <button onClick={() => onValiderSerie(exIndex, setIndex)} disabled={!coachRemplie} className={cn('h-11 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-20', serieFaite ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}><Check className="size-4" /></button>
                  <button onClick={() => onSupprimerSerie(exIndex, 'tracking', setIndex)} className="h-11 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onCopierCoach(exIndex)} className="flex-1 py-3 bg-secondary hover:bg-accent text-foreground text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">{t('copierCoach')}</button>
            <button onClick={() => onAjouterSerie(exIndex, 'tracking')} className="flex-1 py-3 bg-secondary hover:bg-accent text-foreground text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">{t('serieExtra')}</button>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('notesEtTempo')}</span>
        <input placeholder={t('exempleTempo')} value={ex.comments} onChange={(e) => onPatch(exIndex, { comments: e.target.value })} className="w-full p-4 bg-secondary border border-border rounded-xl text-xs font-bold uppercase tracking-widest text-foreground outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder:text-muted-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2 ml-1">{t('douleur')}</span>
        {PAIN_LEVELS.map((p) => (
          <button key={p.value} onClick={() => onPatch(exIndex, { painLevel: ex.painLevel === p.value ? null : p.value })} className={cn('px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors', ex.painLevel === p.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground')}>
            {p.emoji} {t(p.cle)}
          </button>
        ))}
      </div>
    </div>
  )
})