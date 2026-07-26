'use client'

import { useState, useEffect } from 'react'
import { Card, CardTitle } from '@/components/power/card'
import { Weight, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface BodyweightLog {
  id: string
  date: string
  weight: number
}

function toLocalDateStr(d: Date): string {
  const annee = d.getFullYear()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

export function BodyweightTracker() {
  const [logs, setLogs] = useState<BodyweightLog[]>([])
  const [currentWeight, setCurrentWeight] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('bodyweight_logs')
        .select('*')
        .order('date', { ascending: true })

      if (error) throw error
      setLogs(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWeight || isNaN(Number(currentWeight))) {
      toast('Veuillez entrer un poids valide', 'error')
      return
    }

    const weightNum = parseFloat(currentWeight)
    const todayStr = toLocalDateStr(new Date())

    try {
      // Get the session to find the user_id (doit correspondre à l'email du
      // JWT pour passer la policy RLS de bodyweight_logs — NEXT_PUBLIC_SYNC_USER_ID
      // est réservé au raccourci iPhone de synchro des pas, pas à ce compte)
      const res = await fetch('/api/auth/session')
      const session = await res.json()

      const syncUserId = session?.user?.email?.split('@')[0]
      if (!syncUserId) {
        toast('Erreur auth, introuvable', 'error')
        return
      }

      // Upsert
      const { data: existing, error: selError } = await supabase
        .from('bodyweight_logs')
        .select('id')
        .eq('date', todayStr)
        .eq('user_id', syncUserId)
        .limit(1)
      if (selError) throw selError

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('bodyweight_logs')
          .update({ weight: weightNum })
          .eq('id', existing[0].id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('bodyweight_logs')
          .insert([{ user_id: syncUserId, date: todayStr, weight: weightNum }])
        if (error) throw error
      }
      
      toast('Poids enregistré !', 'success')
      setCurrentWeight('')
      fetchLogs()
    } catch (e) {
      toast('Erreur lors de la sauvegarde', 'error')
      console.error(e)
    }
  }

  const chartData = logs.map(l => ({
    date: new Date(l.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    Poids: l.weight
  }))

  return (
    <Card>
      <CardTitle icon={Weight} title="Poids de Corps (PDC)" hint="Historique et saisie" />
      <div className="p-4 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            type="number"
            step="0.1"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            placeholder="Ex: 80.5"
            className="bg-secondary text-foreground p-2 rounded-md w-32 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="submit" className="bg-primary text-primary-foreground p-2 rounded-md flex items-center gap-1 hover:bg-primary/90 transition">
            <Plus className="size-4" /> Ajouter
          </button>
        </form>

        {!loading && logs.length > 0 && (
          <div className="h-48 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="Poids" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && logs.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4">Aucun historique de poids. Saisis ton premier poids ci-dessus !</p>
        )}
      </div>
    </Card>
  )
}
