'use client'

import { useState } from 'react'
import { Activity, Coffee, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'// Ou '../../lib/utils' selon ton arborescence

export function WeeklySchedule() {
  const [schedule, setSchedule] = useState({
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    samedi: false,
    dimanche: false,
  })

  const toggleDay = (day: keyof typeof schedule) => {
    setSchedule((prev) => ({ ...prev, [day]: !prev[day] }))
  }

  // Composant interne pour générer chaque jour sans dupliquer le code
  const DayCard = ({ dayName, dayKey }: { dayName: string, dayKey: keyof typeof schedule }) => {
    const isSeance = schedule[dayKey]

    return (
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
        {/* En-tête du jour */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="text-lg font-bold text-slate-200 uppercase">{dayName}</div>
          
          <div className="flex items-center gap-3">
            <span className={cn("text-sm font-bold", isSeance ? "text-emerald-400" : "text-slate-500")}>
              {isSeance ? "Séance" : "Repos"}
            </span>
            {/* Bouton Switch Tailwind */}
            <button
              type="button"
              onClick={() => toggleDay(dayKey)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                isSeance ? "bg-emerald-500" : "bg-slate-700"
              )}
            >
              <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out",
                  isSeance ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        {/* Contenu conditionnel */}
        {isSeance ? (
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
              <Activity className="size-4" /> Mode Entraînement activé
            </div>
            <button className="w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-colors text-sm font-bold">
              <Plus className="size-4" /> Programmer la séance
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-bold mb-1">
              <Coffee className="size-4" /> Protocole de récupération
            </div>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>Repos relatif en position de décharge à 90°</li>
              <li>Micro-marches de 10 minutes</li>
              <li>Chaleur sur la zone lombaire droite</li>
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <h2 className="text-lg font-bold text-slate-200 mb-4">Gestion de la semaine</h2>
      <DayCard dayName="Lundi" dayKey="lundi" />
      <DayCard dayName="Mardi" dayKey="mardi" />
      <DayCard dayName="Mercredi" dayKey="mercredi" />
      <DayCard dayName="Jeudi" dayKey="jeudi" />
      <DayCard dayName="Vendredi" dayKey="vendredi" />
      <DayCard dayName="Samedi" dayKey="samedi" />
      <DayCard dayName="Dimanche" dayKey="dimanche" />
    </div>
  )
}