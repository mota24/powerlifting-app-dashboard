'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/power/card'
import { Trophy, TrendingUp, Zap, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { bestE1RM, classifyLift, type SetData, type LiftCategory } from '@/lib/powerlifting'

// Formule IPF GL Hommes Classic
function calculateIPFGL(total: number, bw: number): number {
  if (total <= 0 || bw <= 0) return 0
  const A = 1199.72839
  const B = 1025.18192
  const C = 0.00921
  const denom = A - B * Math.exp(-C * bw)
  return denom > 0 ? (100 * total) / denom : 0
}

export function PrBoard() {
  const [loading, setLoading] = useState(true)
  const [maxes, setMaxes] = useState<{ squat: number; bench: number; deadlift: number }>({ squat: 0, bench: 0, deadlift: 0 })
  const [bodyweight, setBodyweight] = useState<number | null>(null)
  
  useEffect(() => {
    const fetchPRs = async () => {
      try {
        // Fetch workout sets
        const { data: setsData, error: setsError } = await supabase
          .from('workout_sets')
          .select('exercise_name, tracking_data')
          .not('tracking_data', 'is', null)
          
        if (setsError) throw setsError
        
        const currentMaxes: Record<LiftCategory, number> = { squat: 0, bench: 0, deadlift: 0 }
        
        for (const row of (setsData || [])) {
          const cat = classifyLift(row.exercise_name)
          if (!cat) continue
          const e1rm = bestE1RM(row.tracking_data as SetData[])
          if (e1rm > currentMaxes[cat]) {
            currentMaxes[cat] = Math.round(e1rm)
          }
        }
        setMaxes(currentMaxes)

        // Fetch latest bodyweight
        const { data: bwData, error: bwError } = await supabase
          .from('bodyweight_logs')
          .select('weight')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
          
        if (!bwError && bwData) {
          setBodyweight(bwData.weight)
        }
        
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    fetchPRs()
  }, [])

  if (loading) {
    return <div className="text-center text-muted-foreground p-8">Chargement des records...</div>
  }

  const totalSBD = maxes.squat + maxes.bench + maxes.deadlift
  const glScore = bodyweight ? calculateIPFGL(totalSBD, bodyweight) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TOTAL SBD */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-6 flex flex-col justify-center items-center group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Trophy className="size-4 text-yellow-500" />
            Total SBD
          </h2>
          <div className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-xl">
            {totalSBD} <span className="text-2xl md:text-3xl text-zinc-500 font-bold">KG</span>
          </div>
        </div>

        {/* IPF GL */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-6 flex flex-col justify-center items-center group">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Zap className="size-4 text-blue-400" />
            IPF GL Score (Homme)
          </h2>
          <div className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-xl">
            {glScore > 0 ? glScore.toFixed(2) : '--'} 
          </div>
          <div className="text-xs text-zinc-500 mt-2 font-medium">
            {bodyweight ? `Calculé avec PDC : ${bodyweight} kg` : "Aucun poids de corps enregistré"}
          </div>
        </div>
      </div>

      <h3 className="text-sm font-bold text-white uppercase tracking-widest pl-2">Records par Mouvement (1RM Estimé)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LiftRecordCard title="Squat" value={maxes.squat} color="text-red-500" />
        <LiftRecordCard title="Bench" value={maxes.bench} color="text-yellow-500" />
        <LiftRecordCard title="Deadlift" value={maxes.deadlift} color="text-blue-500" />
      </div>
    </div>
  )
}

function LiftRecordCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <Card className="p-5 flex flex-col hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-400">{title}</h4>
        <TrendingUp className={`size-4 ${color}`} />
      </div>
      <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-1">
        {value} <span className="text-lg text-zinc-500 font-bold">KG</span>
      </div>
      <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <ArrowUpRight className="size-3" /> All time record
      </div>
    </Card>
  )
}
