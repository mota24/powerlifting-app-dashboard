'use client'

import { cn } from '@/lib/utils'

type MetricSliderProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  danger?: boolean
  onChange: (value: number) => void
}

export function MetricSlider({
  label,
  value,
  min = 1,
  max = 10,
  step = 1,
  unit,
  danger = false,
  onChange,
}: MetricSliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  const active = danger && value > 5

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-sm font-medium',
            active ? 'text-destructive' : 'text-foreground',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 font-mono text-sm tabular-nums',
            active
              ? 'bg-destructive/20 text-destructive'
              : 'bg-secondary text-foreground',
          )}
        >
          {value}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full outline-none',
          '[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md',
          '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background',
          active
            ? '[&::-webkit-slider-thumb]:bg-destructive [&::-moz-range-thumb]:bg-destructive'
            : '[&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary',
        )}
        style={{
          background: `linear-gradient(to right, ${
            active ? 'var(--destructive)' : 'var(--primary)'
          } ${pct}%, var(--secondary) ${pct}%)`,
        }}
      />
    </div>
  )
}
