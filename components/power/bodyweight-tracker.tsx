'use client'

import { useState, useEffect } from 'react'
import { Card, CardTitle } from '@/components/power/card'
import { Weight, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useT, useLocale } from '@/app/ThemeContext'
import { parseLocalDate, toLocalDateStr } from '@/lib/powerlifting'

interface BodyweightLog {
  id: string
  date: string
  weight: number
}

export function BodyweightTracker() {
  const t = useT()
  const locale = useLocale()
  const [logs, setLogs] = useState<BodyweightLog[]>([])
  const [currentWeight, setCurrentWeight] = useState('')
  const [loading, setLoading] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('bodyweight_logs').select('id, date, weight').order('date', { ascending: true }).then(({ data, error }) => {
      if (cancelled) return
      if (error) toast(t('erreurChargement'), 'error')
      else setLogs((data ?? []) as BodyweightLog[])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [version, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const poids = parseFloat(currentWeight.replace(',', '.'))
    if (!Number.isFinite(poids) || poids <= 0 || poids > 500) {
      toast(t('poidsInvalide'), 'error')
      return
    }
    setEnvoi(true)
    // Une pesée par jour : la base remplit le compte (user_id) d'après la
    // session et la contrainte (user_id, date) remplace celle du jour.
    const { error } = await supabase
      .from('bodyweight_logs')
      .upsert({ date: toLocalDateStr(new Date()), weight: poids }, { onConflict: 'user_id,date' })
    setEnvoi(false)
    if (error) {
      toast(t('erreurSauvegarde'), 'error')
      return
    }
    toast(t('poidsEnregistre'), 'success')
    setCurrentWeight('')
    setVersion((v) => v + 1)
  }

  const chartData = logs.map((l) => ({
    date: parseLocalDate(l.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    Poids: l.weight,
  }))

  return (
    <Card>
      <CardTitle icon={Weight} title={t('poidsDeCorps')} hint="" />
      <div className="p-4 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            placeholder={t('exemplePoids')}
            className="bg-secondary text-foreground p-2 rounded-md w-32 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="submit" disabled={envoi} className="bg-primary text-primary-foreground p-2 rounded-md flex items-center gap-1 hover:opacity-90 transition disabled:opacity-50">
            {envoi ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />} {t('ajouter')}
          </button>
        </form>

        {!loading && logs.length > 0 && (
          <div className="h-48 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="Poids" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && logs.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4">{t('aucunHistoriquePoids')}</p>
        )}
      </div>
    </Card>
  )
}
