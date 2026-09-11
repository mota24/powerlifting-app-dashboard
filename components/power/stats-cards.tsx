'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateIPFGL, classifyLift, setE1RM, toLocalDateStr, CATEGORIES_PAR_MODE, type ModeApp, type SetData } from '@/lib/powerlifting'
import { Trophy, Edit2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, useT } from '@/app/ThemeContext'

type Records = { squat: number; bench: number; deadlift: number }
const RECORDS_VIDES: Records = { squat: 0, bench: 0, deadlift: 0 }

// Clé séparée par mode : sur un navigateur partagé, les records de
// l'un ne doivent pas s'afficher chez l'autre.
const clePrs = (mode: ModeApp) => `mota_real_prs_${mode}`

function lireRecords(mode: ModeApp): Records {
  try {
    // Reprise de l'ancienne clé non préfixée, écrite avant le multi-compte.
    const saved = localStorage.getItem(clePrs(mode)) ?? (mode === 'fitness' ? null : localStorage.getItem('mota_real_prs'))
    const valeurs = saved ? (JSON.parse(saved) as Partial<Records>) : {}
    return { squat: Number(valeurs.squat) || 0, bench: Number(valeurs.bench) || 0, deadlift: Number(valeurs.deadlift) || 0 }
  } catch {
    return RECORDS_VIDES
  }
}

export function StatsCards() {
  const { mode } = useTheme()
  // Remonté à chaque changement de mode : les records locaux sont relus pour le bon compte.
  return <StatsCardsMode key={mode} mode={mode} />
}

function StatsCardsMode({ mode }: { mode: ModeApp }) {
  const t = useT()
  const estFitness = mode === 'fitness'
  const categories = CATEGORIES_PAR_MODE[mode]

  const [isEditing, setIsEditing] = useState(false)
  const [realPrs, setRealPrs] = useState(() => lireRecords(mode))
  const [tempPrs, setTempPrs] = useState(realPrs)
  const [theoPrs, setTheoPrs] = useState(RECORDS_VIDES)
  const [bodyweight, setBodyweight] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('bodyweight_logs').select('weight').order('date', { ascending: false }).limit(1).maybeSingle().then(({ data, error }) => {
      if (!cancelled && !error && data) setBodyweight(data.weight)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const since = new Date()
    since.setMonth(since.getMonth() - 6)
    supabase.from('workout_sets').select('exercise_name, tracking_data').gte('date', toLocalDateStr(since)).not('tracking_data', 'is', null).then(({ data }) => {
      if (cancelled || !data) return
      const maxes = { ...RECORDS_VIDES }
      for (const row of data as { exercise_name: string | null; tracking_data: SetData[] | null }[]) {
        const category = classifyLift(row.exercise_name, mode)
        if (!category || !row.tracking_data) continue
        for (const set of row.tracking_data) {
          const e1rm = setE1RM(set)
          if (e1rm > maxes[category]) maxes[category] = e1rm
        }
      }
      setTheoPrs({ squat: Math.round(maxes.squat), bench: Math.round(maxes.bench), deadlift: Math.round(maxes.deadlift) })
    })
    return () => { cancelled = true }
  }, [mode])

  const commencerEdition = () => {
    // Repart des records enregistrés : une édition annulée ne doit pas réapparaître.
    setTempPrs(realPrs)
    setIsEditing(true)
  }

  const handleSaveRealPrs = () => {
    setRealPrs(tempPrs)
    try { localStorage.setItem(clePrs(mode), JSON.stringify(tempPrs)) } catch { }
    setIsEditing(false)
  }

  const totalReel = realPrs.squat + realPrs.bench + realPrs.deadlift
  const totalTheo = Math.max(realPrs.squat, theoPrs.squat) + Math.max(realPrs.bench, theoPrs.bench) + Math.max(realPrs.deadlift, theoPrs.deadlift)
  const glScore = bodyweight ? calculateIPFGL(totalReel, bodyweight) : 0

  return (
    <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900/50 pb-4">
        <div className="flex items-center gap-3">
          <Trophy className="size-4 text-white" />
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">{estFitness ? t('meilleuresCharges') : t('recordsTitre')}</h2>
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="p-2 text-zinc-500 hover:text-white rounded-lg"><X className="size-4" /></button>
            <button onClick={handleSaveRealPrs} className="p-2 text-black bg-white hover:bg-zinc-200 rounded-lg"><Check className="size-4" /></button>
          </div>
        ) : (
          <button onClick={commencerEdition} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
            <Edit2 className="size-3" /> {t('modifier')}
          </button>
        )}
      </div>

      <div className={cn('grid grid-cols-2 gap-4', estFitness ? 'md:grid-cols-4' : 'md:grid-cols-5')}>
        {categories.map(({ key: lift, cle }) => {
          const reel = realPrs[lift]
          const theorique = theoPrs[lift]
          // Un maximum THÉORIQUE ne peut pas être inférieur à une barre
          // réellement soulevée : le PR validé sert de plancher.
          const affiche = Math.max(reel, theorique)
          const depasseLePr = theorique > reel
          return (
            <div key={lift} className="p-4 bg-zinc-900 rounded-xl">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{t(cle)}</h3>
              {isEditing ? (
                <input type="number" value={tempPrs[lift]} onChange={(e) => setTempPrs({ ...tempPrs, [lift]: parseInt(e.target.value) || 0 })} className="w-full bg-black p-3 rounded-lg border border-zinc-800 text-white font-black tabular-nums outline-none mb-1 text-lg" />
              ) : (
                <div className="text-3xl font-black text-white tabular-nums mb-1">{reel}</div>
              )}
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                e1RM: <span className={cn(depasseLePr ? 'text-white' : 'text-zinc-600')}>{affiche > 0 ? affiche : '-'} kg</span>
              </div>
            </div>
          )
        })}

        <div className="p-4 bg-white rounded-xl text-black flex flex-col justify-between">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{estFitness ? t('total') : t('totalSBD')}</h3>
          <div className="text-3xl font-black tabular-nums mb-1">{totalReel}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            e1RM: <span className="text-black">{totalTheo} kg</span>
          </div>
        </div>

        {!estFitness && (
          <div className="p-4 bg-zinc-900 rounded-xl flex flex-col justify-between">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">IPF GL</h3>
            <div className="text-3xl font-black text-white tabular-nums mb-1">{glScore > 0 ? glScore.toFixed(2) : '--'}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              PDC: <span className="text-white">{bodyweight ? `${bodyweight} kg` : '--'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
