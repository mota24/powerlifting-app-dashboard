'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateIPFGL, classifyLift, setE1RM, toLocalDateStr, CATEGORIES_PAR_MODE, type SetData } from '@/lib/powerlifting'
import { Trophy, Edit2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, useT } from '@/app/ThemeContext'

export function StatsCards() {
  const { mode } = useTheme()
  const t = useT()
  const estFitness = mode === 'fitness'
  // Clé séparée par mode : sur un navigateur partagé, les records de
  // l'un ne doivent pas s'afficher chez l'autre.
  const clePrs = `mota_real_prs_${mode}`
  const categories = CATEGORIES_PAR_MODE[mode]

  const [isEditing, setIsEditing] = useState(false)
  const [realPrs, setRealPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })
  const [tempPrs, setTempPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })
  const [theoPrs, setTheoPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })
  const [bodyweight, setBodyweight] = useState<number | null>(null)

  useEffect(() => {
    // Reprise de l'ancienne clé non préfixée, écrite avant le multi-compte.
    const saved = localStorage.getItem(clePrs) ?? (estFitness ? null : localStorage.getItem('mota_real_prs'))
    const valeurs = saved ? JSON.parse(saved) : { squat: 0, bench: 0, deadlift: 0 }
    setRealPrs(valeurs)
    setTempPrs(valeurs)
  }, [clePrs, estFitness])

  useEffect(() => {
    const fetchBodyweight = async () => {
      const { data, error } = await supabase
        .from('bodyweight_logs')
        .select('weight')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!error && data) setBodyweight(data.weight)
    }
    fetchBodyweight()
  }, [])

  useEffect(() => {
    let cancelled = false
    const calculateTheo1RM = async () => {
      const since = new Date()
      since.setMonth(since.getMonth() - 6)
      const { data } = await supabase.from('workout_sets').select('exercise_name, tracking_data').gte('date', toLocalDateStr(since)).not('tracking_data', 'is', null)
      if (cancelled || !data) return

      const maxes = { squat: 0, bench: 0, deadlift: 0 }
      for (const row of data as { exercise_name: string | null; tracking_data: SetData[] | null }[]) {
        const category = classifyLift(row.exercise_name, mode)
        if (!category || !row.tracking_data) continue
        for (const set of row.tracking_data) {
          const e1rm = setE1RM(set)
          if (e1rm > maxes[category]) maxes[category] = e1rm
        }
      }
      setTheoPrs({ squat: Math.round(maxes.squat), bench: Math.round(maxes.bench), deadlift: Math.round(maxes.deadlift) })
    }
    calculateTheo1RM()
    return () => { cancelled = true }
  }, [mode])

  const handleSaveRealPrs = () => {
    setRealPrs(tempPrs)
    localStorage.setItem(clePrs, JSON.stringify(tempPrs))
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
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
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