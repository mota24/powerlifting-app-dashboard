'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Flame, Shield, Trophy, Medal, Star, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const [progress, setProgress] = useState({
    level: 1,
    current_xp: 0,
    streak_days: 0
  })

  useEffect(() => {
    // 1. Récupération initiale des données du joueur
    const fetchProgress = async () => {
      const { data } = await supabase.from('user_progress').select('*').limit(1).single()
      if (data) {
        setProgress(data)
      }
    }
    fetchProgress()

    // 2. Écoute des mises à jour en temps réel (la barre bougera toute seule)
    const channel = supabase
      .channel('progress_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_progress' }, (payload) => {
        setProgress(payload.new as any)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Formule d'XP : chaque niveau demande 1000 XP multiplié par le niveau actuel
  const xpNeeded = progress.level * 1000 
  const progressPercentage = Math.min(100, Math.max(0, (progress.current_xp / xpNeeded) * 100))

  // Détermination du Grade et de la couleur
  let GradeIcon = Shield
  let gradeName = "Débutant du Plateau"
  let gradeColor = "text-amber-600" // Bronze

  if (progress.level >= 11 && progress.level <= 20) {
    GradeIcon = Medal
    gradeName = "Compétiteur Déterminé"
    gradeColor = "text-slate-300" // Argent
  } else if (progress.level >= 21 && progress.level <= 30) {
    GradeIcon = Trophy
    gradeName = "Maître de la Surcharge"
    gradeColor = "text-yellow-400" // Or
  } else if (progress.level >= 31 && progress.level <= 45) {
    GradeIcon = Star
    gradeName = "Élite du SBD"
    gradeColor = "text-cyan-300" // Platine
  } else if (progress.level >= 46 && progress.level <= 50) {
    GradeIcon = Crown
    gradeName = "Légende"
    gradeColor = "text-violet-400" // Diamant
  } else if (progress.level > 50) {
    GradeIcon = Crown
    gradeName = "Prestige"
    gradeColor = "text-rose-500" // Rouge feu
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
        
        {/* Identité visuelle & Grade actuel */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Mota</h1>
              <span className="text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Perf</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <GradeIcon className={cn("size-3.5", gradeColor)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", gradeColor)}>
                {gradeName}
              </span>
            </div>
          </div>
        </div>

        {/* HUD (Heads Up Display) : Niveau, XP et Streak */}
        <div className="flex items-center gap-4">
          
          {/* Barre XP (Cachée sur tout petit écran, visible sur moyen/grand) */}
          <div className="hidden sm:flex flex-col items-end gap-1 w-32 md:w-48">
            <div className="flex justify-between w-full items-end">
              <span className="text-[10px] font-black text-blue-400">NIV {progress.level}</span>
              <span className="text-[10px] font-medium text-slate-500">{progress.current_xp} / {xpNeeded} XP</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Indicateur de Streak (Jours d'affilée) */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg shadow-inner">
            <Flame className={cn("size-4", progress.streak_days >= 3 ? "text-orange-500" : "text-slate-600")} />
            <span className={cn("text-sm font-black", progress.streak_days >= 3 ? "text-orange-500" : "text-slate-500")}>
              {progress.streak_days}
            </span>
          </div>
          
        </div>
      </div>
      
      {/* Barre XP fine collée en bas du Header pour les téléphones (Mobile UX) */}
      <div className="sm:hidden h-1 w-full bg-slate-900">
        <div 
          className="h-full bg-blue-500 transition-all duration-1000 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </header>
  )
}