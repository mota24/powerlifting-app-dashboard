'use client'

import { useState } from 'react'
import { EXERCISES, epley1RM, roundToHalf } from '@/lib/powerlifting'
import { Card, CardTitle } from './card'
import { MetricSlider } from './metric-slider'
import { ClipboardList, Sparkles, TriangleAlert, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const SAFE_VARIANTS = [
  'Box Squat (réduit charge axiale)',
  'Belt Squat / Hack Squat',
  'Tirage poitrine au lieu du Deadlift lourd',
  'Travail unilatéral léger',
]

export function SessionForm() {
  const [exerciseKey, setExerciseKey] = useState('bench')
  const [isVariant, setIsVariant] = useState(false)
  const [load, setLoad] = useState(120)
  const [reps, setReps] = useState(3)
  const [rpe, setRpe] = useState(8)

  const [sensations, setSensations] = useState(7)
  const [fatigue, setFatigue] = useState(4)
  const [sleep, setSleep] = useState(7.5)
  const [steps, setSteps] = useState(8000)
  const [pain, setPain] = useState(2)

  const ex = EXERCISES[exerciseKey]
  const displayName = isVariant ? ex.variant : ex.base
  const est1rm = roundToHalf(epley1RM(load, reps))
  const painAlert = pain > 5

  function handleExerciseChange(key: string) {
    setExerciseKey(key)
    setIsVariant(false)
  }

  function toggleSmartVariant() {
    const next = !isVariant
    // Variante intelligente : baisse la charge cible de 10% (ou rétablit)
    setLoad((l) => roundToHalf(next ? l * 0.9 : l / 0.9))
    setIsVariant(next)
  }

  return (
    <Card className={cn(painAlert && 'border-destructive/60')}>
      <CardTitle
        icon={ClipboardList}
        title="Séance Active"
        hint="Saisie en temps réel"
      />

      {/* Alerte sécurité bloquante */}
      {painAlert ? (
        <div
          role="alert"
          className="mb-4 animate-pulse rounded-xl border border-destructive bg-destructive/15 p-4"
        >
          <div className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-5 shrink-0" />
            <span className="font-bold">⚠️ Alerte Surcharge Axiale</span>
          </div>
          <p className="mt-1 text-sm text-destructive/90">
            Douleur articulaire/lombaire élevée ({pain}/10). Stoppez les charges
            axiales lourdes et basculez sur une variante :
          </p>
          <ul className="mt-2 space-y-1">
            {SAFE_VARIANTS.map((v) => (
              <li
                key={v}
                className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
              >
                <ShieldCheck className="size-3.5 shrink-0" />
                {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Sélecteur d'exercice */}
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(EXERCISES).map(([key, val]) => (
          <button
            key={key}
            type="button"
            onClick={() => handleExerciseChange(key)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              exerciseKey === key
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {val.base}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-secondary/50 p-3">
        <div>
          <span className="block text-xs text-muted-foreground">
            Exercice sélectionné
          </span>
          <span className="text-lg font-semibold text-foreground">
            {displayName}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleSmartVariant}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            isVariant
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/15 text-primary hover:bg-primary/25',
          )}
        >
          <Sparkles className="size-4" />
          {isVariant ? 'Variante active' : 'Variante Intelligente'}
        </button>
      </div>

      {/* Champs numériques */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <NumberField label="Charge (kg)" value={load} step={2.5} onChange={setLoad} />
        <NumberField label="Reps" value={reps} step={1} onChange={setReps} />
        <NumberField label="RPE" value={rpe} step={0.5} max={10} onChange={setRpe} />
      </div>

      <div className="mb-5 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          1RM estimé (Epley)
        </span>
        <span className="font-mono text-2xl font-bold text-primary">
          {est1rm} kg
        </span>
      </div>

      {/* Métriques de récupération */}
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Récupération
      </h3>
      <div className="space-y-4">
        <MetricSlider label="Sensations" value={sensations} onChange={setSensations} />
        <MetricSlider label="Fatigue" value={fatigue} onChange={setFatigue} />
        <MetricSlider
          label="Sommeil"
          value={sleep}
          min={0}
          max={12}
          step={0.5}
          unit="h"
          onChange={setSleep}
        />
        <MetricSlider
          label="Pas journaliers"
          value={steps}
          min={0}
          max={20000}
          step={500}
          onChange={setSteps}
        />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <MetricSlider
            label="Douleur Lombaire / Articulaire"
            value={pain}
            danger
            onChange={setPain}
          />
        </div>
      </div>
    </Card>
  )
}

function NumberField({
  label,
  value,
  step = 1,
  max,
  onChange,
}: {
  label: string
  value: number
  step?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        step={step}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-center font-mono text-lg text-foreground outline-none focus:border-primary"
      />
    </label>
  )
}
