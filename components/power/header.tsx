'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Flame, Shield, Trophy, Medal, Star, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProgress {
  level: number;
  current_xp: number;
  streak_days: number;
}

export function Header() {
  const [progress, setProgress] = useState<HeaderProgress>({
    level: 1,
    current_xp: 0,
    streak_days: 0
  })

  useEffect(() => {
    const fetchProgress = async () => {
      const { data } = await supabase.from('user_progress').select('*').limit(1).single()
      if (data) setProgress(data)
    }
    fetchProgress()
    window.addEventListener('user-progress-updated', fetchProgress)
    return () => window.removeEventListener('user-progress-updated', fetchProgress)
  }, [])

  const xpNeeded = progress.level * 1000 
  const progressPercentage = Math.min(100, Math.max(0, (progress.current_xp / xpNeeded) * 100))

  let GradeIcon = Shield
  let gradeName = "DÉBUTANT"
  let gradeColor = "text-zinc-500"

  if (progress.level >= 11 && progress.level <= 20) { GradeIcon = Medal; gradeName = "COMPÉTITEUR"; gradeColor = "text-zinc-400" } 
  else if (progress.level >= 21 && progress.level <= 30) { GradeIcon = Trophy; gradeName = "MAÎTRE"; gradeColor = "text-zinc-300" } 
  else if (progress.level >= 31 && progress.level <= 45) { GradeIcon = Star; gradeName = "ÉLITE"; gradeColor = "text-zinc-100" } 
  else if (progress.level > 45) { GradeIcon = Crown; gradeName = "LÉGENDE"; gradeColor = "text-white" }

  return (
    // Fond 100 % opaque et z-50 : le contenu qui défile passe DERRIÈRE la
    // barre de niveau au lieu de la traverser. Le flou n'a plus lieu d'être.
    <header className="sticky top-0 z-50 w-full border-b border-zinc-900 bg-zinc-950">
      <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
        
        <div className="flex items-center gap-3">
          <GradeIcon className={cn("size-4", gradeColor)} />
          <span className={cn("text-[10px] font-bold uppercase tracking-widest", gradeColor)}>
            {gradeName}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end gap-1.5 w-32 md:w-48">
            <div className="flex justify-between w-full items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">NIV {progress.level}</span>
              <span className="text-[10px] font-medium text-zinc-500 tabular-nums">{progress.current_xp} / {xpNeeded}</span>
            </div>
            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
            </div>
          </div>

          {/* La flamme s'allume dès le 1er jour de série : à l'ancien seuil de
              3, un streak en cours restait gris et semblait éteint. */}
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
            <Flame className={cn("size-3.5", progress.streak_days > 0 ? "text-orange-500" : "text-zinc-600")} />
            <span className={cn("text-xs font-black tabular-nums", progress.streak_days > 0 ? "text-white" : "text-zinc-500")}>
              {progress.streak_days}
            </span>
          </div>
        </div>
      </div>
      
      <div className="sm:hidden h-0.5 w-full bg-zinc-900">
        <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
      </div>
    </header>
  )
}