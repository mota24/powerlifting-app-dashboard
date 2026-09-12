'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Activity, Award, Coffee, Copy, Dumbbell, Plus, RefreshCw, Sparkles, Trash2, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/components/power/toaster'
import { useLocale, useT, useTheme } from '@/app/ThemeContext'
import { ACCESSORIES, FIT_ACCESSOIRES, bestE1RM, classifyLift, parseLocalDate, sessionTonnage, setsTonnage, suggestionsExercices, toLocalDateStr, type LiftCategory, type SetData, type UpcomingCompetition } from '@/lib/powerlifting'
import { REST_NAMES, creerExerciceVierge, exerciceVide, formatDateAffichage, videSet, type ExerciceRow, type UserProgress, type WorkoutSetRow } from '@/lib/seance'
import { joursProgrammes, nouvelleSerie, type LigneJour } from '@/lib/serie'
import { cleExercice, seriePrescrite, suggererProgression, type SeanceExercice } from '@/lib/progression'
import { proposerAnnulation } from '@/lib/annulation'
import { countryCodeToFlag } from '@/lib/countries'
import type { ModeleSeance } from '@/lib/modeles'
import { PhotosSeance } from '@/components/power/photos-seance'
import { ModelesSeance } from '@/components/power/modeles-seance'
import { RestTimer } from '@/components/power/rest-timer'
import { DailyMetrics } from '@/components/power/daily-metrics'
import { ExerciseCard } from '@/components/power/exercise-card'

interface Props { dateActive: Date; isRestDayMode: boolean; setIsRestDayMode: (val: boolean) => void; pasDuJour: number | null; setDateActive: (date: Date) => void; nextCompetition: UpcomingCompetition | null; onGoToPalmares: (competitionId: string) => void; }
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
