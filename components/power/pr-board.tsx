'use client'

import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  const [totalReel, setTotalReel] = useState(0)
  const [bodyweight, setBodyweight] = useState<number | null>(null)

  useEffect(() => {
    // Mêmes vrais max que la carte "Records 1RM" (localStorage 'mota_real_prs')
    const saved = localStorage.getItem('mota_real_prs')
    if (saved) {
      const prs = JSON.parse(saved)
      setTotalReel((prs.squat || 0) + (prs.bench || 0) + (prs.deadlift || 0))
    }

    const fetchBodyweight = async () => {
      try {
        const { data, error } = await supabase
          .from('bodyweight_logs')
          .select('weight')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!error && data) setBodyweight(data.weight)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    fetchBodyweight()
  }, [])

  if (loading) {
    return <div className="text-center text-muted-foreground p-8">Chargement du score IPF...</div>
  }

  const glScore = bodyweight ? calculateIPFGL(totalReel, bodyweight) : 0

  return (
    <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-col items-center">
      <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-3">
        <Zap className="size-4 text-blue-400" /> IPF GL Score (Homme)
      </h2>
      <div className="text-5xl md:text-6xl font-black text-white tracking-tighter tabular-nums">
        {glScore > 0 ? glScore.toFixed(2) : '--'}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-3">
        {bodyweight ? `Total ${totalReel} kg · PDC ${bodyweight} kg` : 'Enregistre ton PDC pour calculer ton score'}
      </div>
    </div>
  )
}
